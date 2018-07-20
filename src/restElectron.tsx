import * as utils from "@glosfer/hyconjs-util"
import * as bip39 from "bip39"
import * as crypto from "crypto"
import HDKey = require("hdkey")
import * as datastore from "nedb"
import * as tfa from "node-2fa"
import * as secp256k1 from "secp256k1"
import { chinese_simplified } from "../mnemonic/chinese_simplified"
import { chinese_traditional } from "../mnemonic/chinese_traditional"
import { english } from "../mnemonic/english"
import { french } from "../mnemonic/french"
import { italian } from "../mnemonic/italian"
import { japanese } from "../mnemonic/japanese"
import { korean } from "../mnemonic/korean"
import { spanish } from "../mnemonic/spanish"
import * as proto from "./serialization/proto"

// tslint:disable-next-line:no-var-requires
const { ipcRenderer } = require("electron")

import { isValidElement } from "../node_modules/@types/react"
import {
    IBlock,
    IHyconWallet,
    IMinedInfo,
    IMiner,
    IPeer,
    IResponseError,
    IRest,
    ITxProp,
    IWalletAddress,
} from "./rest"

function getBip39Wordlist(language?: string) {
    switch (language.toLowerCase()) {
        case "english":
            return english
        case "korean":
            return korean
        case "chinese_simplified":
            return chinese_simplified
        case "chinese_traditional":
            return chinese_traditional
        case "chinese":
            throw new Error("Did you mean chinese_simplified or chinese_traditional?")
        case "japanese":
            return japanese
        case "french":
            return french
        case "spanish":
            return spanish
        case "italian":
            return italian
        default:
            return english
    }
}

function bytesToHex(bytes: Uint8Array) {
    const hex = []
    for (const byte of bytes) {
        // tslint:disable:no-bitwise
        hex.push((byte >>> 4).toString(16))
        hex.push((byte & 0xF).toString(16))
    }
    return hex.join("")
}

interface IStoredWallet {
    data: string
    iv: string
    address: string
    hint: string
    name: string
}

interface IStoredFavorite {
    alias: string
    address: string
}

// tslint:disable:no-console
// tslint:disable:ban-types
// tslint:disable:object-literal-sort-keys
export class RestElectron implements IRest {
    public readonly coinNumber: number = 1397
    public readonly url = "https://network.hycon.io"
    public apiVersion = "v1"
    public loading: boolean
    public isHyconWallet: boolean
    public callback: (loading: boolean) => void
    public userPath: string = ipcRenderer.sendSync("getUserPath")
    public osArch: string = ipcRenderer.sendSync("getOSArch")
    public walletsDB = new datastore({ filename: this.userPath + "/wallets.db", autoload: true })
    public favoritesDB = new datastore({ filename: this.userPath + "/favorites.db", autoload: true })
    public totpDB = new datastore({ filename: this.userPath + "/totp.db", autoload: true })

    public loadingListener(callback: (loading: boolean) => void): void {
        this.callback = callback
    }
    public setLoading(loading: boolean): void {
        this.loading = loading
        this.callback(this.loading)
    }

    public async sendTx(tx: { name: string, password: string, address: string, amount: string, minerFee: string, nonce: number }, queueTx?: Function): Promise<{ res: boolean, case?: number }> {
        let status = 1
        try {
            const wallet = await this.getWallet(tx.name)
            const from = utils.addressToUint8Array(wallet.address)
            const to = utils.addressToUint8Array(tx.address)
            const addressInfo = await this.getAddressInfo(wallet.address)

            if (addressInfo.nonce < 0) {
                throw new Error("Nonce is not valid.")
            }
            status = 2
            let nonce: number
            if (addressInfo.pendings.length > 0) {
                nonce = addressInfo.pendings[addressInfo.pendings.length - 1].nonce + 1
            } else {
                nonce = addressInfo.nonce + 1
            }

            const iTx: proto.ITx = {
                from,
                to,
                amount: utils.hyconfromString(tx.amount),
                fee: utils.hyconfromString(tx.minerFee),
                nonce,
            }
            const protoTx: Uint8Array = proto.Tx.encode(iTx).finish()
            const txHash: Uint8Array = utils.blake2bHash(protoTx)
            const privateKey = this.decryptWallet(tx.password, wallet.iv, wallet.data).toString()
            const { signature, recovery } = secp256k1.sign(Buffer.from(txHash.buffer), Buffer.from(privateKey, "hex"))
            status = 3

            const signedTx = {
                signature: Buffer.from(signature).toString("hex"),
                from: wallet.address,
                to: tx.address,
                amount: tx.amount,
                fee: tx.minerFee,
                nonce,
                recovery,
            }

            const result = await this.outgoingTx(signedTx)

            if (!("txHash" in result) || (typeof result.txHash) !== "string") {
                throw new Error("Fail to transfer hycon.")
            }
            return { res: true }
        } catch (e) {
            console.log(`error ${e}`)
            return { res: false, case: status }
        }

    }

    public deleteWallet(name: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.walletsDB.remove({ name }, {}, (err: any, n: number) => {
                if (err) {
                    reject(err)
                } else {
                    console.log(`${n} wallet has been removed.`)
                    resolve(true)
                }
            })
        })
    }

    public async generateWallet(Hwallet: IHyconWallet): Promise<string> {
        const address = await this.recoverWallet(Hwallet)
        if (typeof address === "boolean") {
            throw new Error("Could not generate wallet")
        }
        return address
    }

    public getMnemonic(language: string): Promise<string> {
        const wordlist = getBip39Wordlist(language)
        return Promise.resolve(bip39.generateMnemonic(128, undefined, wordlist))
    }

    public async getWalletDetail(name: string): Promise<IHyconWallet | IResponseError> {
        const wallet = await this.getWallet(name)
        const addressInfo = await this.getAddressInfo(wallet.address)
        const address = wallet.address
        const balance = addressInfo.balance
        const pendingAmount = addressInfo.pendingAmount
        const minedBlocks = addressInfo.minedBlocks === undefined ? [] : addressInfo.minedBlocks
        const txs = addressInfo.txs === undefined ? [] : addressInfo.txs
        const pendings = addressInfo.pendings === undefined ? [] : addressInfo.pendings // pending txs
        return { name, address, balance, minedBlocks, txs, pendingAmount, pendings }
    }

    public async getWalletList(index?: number): Promise<{ walletList: IHyconWallet[], length: number }> {
        return new Promise<{ walletList: IHyconWallet[], length: number }>((resolve, _) => {
            const walletList: IHyconWallet[] = []
            this.walletsDB.find({}, async (err: Error, docs: IStoredWallet[]) => {
                if (err) {
                    console.log(err)
                    return
                }

                for (const doc of docs) {
                    const account = await this.getAddressInfo(doc.address)
                    walletList.push({ name: doc.name, address: doc.address, balance: account.balance, pendingAmount: account.pendingAmount })
                }
                resolve({ walletList, length: walletList.length })
            })
        })
    }

    public async recoverWallet(Hwallet: IHyconWallet): Promise<string> {
        if (Hwallet.name === undefined || Hwallet.mnemonic === undefined || Hwallet.language === undefined) {
            return Promise.reject("params")
        }

        if (await this.checkDupleName(Hwallet.name)) {
            return Promise.reject("name")
        }

        const wordlist = getBip39Wordlist(Hwallet.language)

        if (!bip39.validateMnemonic(Hwallet.mnemonic, wordlist)) {
            return Promise.reject("mnemonic")
        }

        if (Hwallet.password === undefined) { Hwallet.password = "" }
        if (Hwallet.passphrase === undefined) { Hwallet.passphrase = "" }
        if (Hwallet.hint === undefined) { Hwallet.hint = "" }

        try {
            const seed = bip39.mnemonicToSeed(Hwallet.mnemonic, Hwallet.passphrase)
            const masterKey = HDKey.fromMasterSeed(seed)
            const wallet = masterKey.derive(`m/44'/${this.coinNumber}'/0'/0/0`)

            const iv = crypto.randomBytes(16)
            const key = Buffer.from(utils.blake2bHash(Hwallet.password).buffer)
            const cipher = crypto.createCipheriv("aes-256-cbc", key, iv)
            const encryptedData = Buffer.concat([cipher.update(Buffer.from(wallet.privateKey.toString("hex"))), cipher.final()])
            const address = utils.publicKeyToAddress(wallet.publicKey)
            const addressStr = utils.addressToString(address)
            const store: IStoredWallet = {
                iv: iv.toString("hex"),
                data: encryptedData.toString("hex"),
                address: addressStr,
                hint: Hwallet.hint,
                name: Hwallet.name,
            }

            if (await this.checkDupleAddress(addressStr)) {
                return Promise.reject("address")
            }

            return new Promise<string>((resolve, reject) => {
                this.walletsDB.insert(store, (err: Error, doc: IStoredWallet) => {
                    if (err) {
                        console.error(err)
                        reject("db")
                    } else {
                        // console.log(`Stored ${doc.address} -> ${JSON.stringify(doc)}`)
                        resolve(doc.address)
                    }
                })
            })

        } catch (e) {
            return Promise.reject("bip39")
        }
    }

    public async getHint(name: string): Promise<string> {
        const wallet = await this.getWallet(name)
        return wallet.hint
    }

    public async checkDupleName(name: string): Promise<boolean> {
        try {
            await this.getWallet(name)
            return true
        } catch (e) {
            return false
        }
    }

    public getFavoriteList(): Promise<Array<{ alias: string, address: string }>> {
        return new Promise((resolve, reject) => {
            this.favoritesDB.find({}, (err: Error, docs: IStoredFavorite[]) => {
                if (err) {
                    reject(err)
                    return
                }

                const list: Array<{ alias: string, address: string }> = []
                for (const favorite of docs) {
                    list.push({ alias: favorite.alias, address: favorite.address })
                }
                resolve(list)
            })
        })
    }

    public async addFavorite(alias: string, address: string): Promise<boolean> {
        const store: IStoredFavorite = {
            alias,
            address,
        }
        return new Promise<boolean>((resolve, _) => {
            this.favoritesDB.insert(store, (err: Error, doc: IStoredFavorite) => {
                if (err) {
                    console.error(err)
                    resolve(false)
                } else {
                    console.log(`Stored ${doc.address} -> ${JSON.stringify(doc)}`)
                    resolve(true)
                }
            })
        })
    }
    public deleteFavorite(alias: string) {
        return new Promise<boolean>((resolve, _) => {
            this.favoritesDB.remove({ alias }, {}, (err: Error, n: number) => {
                if (err) {
                    console.error(err)
                    resolve(false)
                    return
                }

                console.log(`Deleted "${alias}" from favorites`)
                resolve(true)
            })
        })
    }

    public async addWalletFile(name: string, password: string, key: string): Promise<boolean> {
        try {
            if (await this.checkDupleName(name)) {
                return false
            }

            const keyArr = key.split(":")
            let hint: string = ""
            let iv: string = ""
            let data: string = ""
            if (keyArr.length === 2) {
                iv = keyArr[0]
                data = keyArr[1]
            } else if (keyArr.length === 3) {
                hint = keyArr[0]
                iv = keyArr[1]
                data = keyArr[2]
            } else {
                throw new Error(`Fail to decryptAES`)
            }

            const privateKey = this.decryptWallet(password, iv, data)
            const publicKeyBuff = secp256k1.publicKeyCreate(Buffer.from(privateKey.toString(), "hex"))
            const address = utils.publicKeyToAddress(publicKeyBuff)
            const store: IStoredWallet = {
                iv,
                data,
                address: utils.addressToString(address),
                hint,
                name,
            }

            return new Promise<boolean>((resolve, _) => {
                this.walletsDB.insert(store, (err: Error, doc: IStoredWallet) => {
                    if (err) {
                        console.error(err)
                        resolve(false)
                    } else {
                        console.log(`Stored ${doc.address} -> ${JSON.stringify(doc)}`)
                        resolve(true)
                    }
                })
            })
        } catch (e) {
            console.log(`${e}`)
            return false
        }
    }

    public outgoingTx(tx: { signature: string, from: string, to: string, amount: string, fee: string, recovery: number, nonce: number }, queueTx?: Function): Promise<{ txHash: string } | IResponseError> {
        const headers = new Headers()
        headers.append("Accept", "application/json")
        headers.append("Content-Type", "application/json")
        return Promise.resolve(fetch(`${this.url}/api/${this.apiVersion}/tx`, {
            method: "POST",
            headers,
            body: JSON.stringify(tx),
        })
            .then((response) => response.json())
            .catch((err: Error) => {
                console.log(err)
            }))
    }

    public getAddressInfo(address: string): Promise<IWalletAddress> {
        const apiVer = this.apiVersion
        return Promise.resolve(
            fetch(`${this.url}/api/${apiVer}/address/${address}`)
                .then((response) => response.json())
                .catch((err: Error) => {
                    console.log(err)
                }),
        )
    }

    public getTx(hash: string): Promise<ITxProp> {
        return Promise.resolve(
            fetch(`${this.url}/api/${this.apiVersion}/tx/${hash}`)
                .then((response) => response.json())
                .catch((err: Error) => {
                    console.log(err)
                }),
        )
    }

    public getPendingTxs(index: number): Promise<{ txs: ITxProp[], length: number, totalCount: number, totalAmount: string, totalFee: string }> {
        return Promise.resolve(
            fetch(`${this.url}/api/${this.apiVersion}/txList/${index}`)
                .then((response) => response.json())
                .catch((err: Error) => {
                    console.log(err)
                }),
        )
    }

    public getNextTxs(address: string, txHash?: string, index?: number): Promise<ITxProp[]> {
        return Promise.resolve(
            fetch(`${this.url}/api/${this.apiVersion}/nextTxs/${address}/${txHash}/${index}`)
                .then((response) => response.json())
                .catch((err: Error) => {
                    console.log(err)
                }),
        )
    }

    public getMinedBlocks(address: string, blockHash: string, index: number): Promise<IMinedInfo[]> {
        return Promise.resolve(
            fetch(`${this.url}/api/${this.apiVersion}/getMinedInfo/${address}/${blockHash}/${index}`)
                .then((response) => response.json())
                .catch((err: Error) => {
                    console.log(err)
                }),
        )
    }

    public async getLedgerWallet(startIndex: number): Promise<IHyconWallet[] | number> {
        try {
            const addresses = ipcRenderer.sendSync("getAddress", startIndex)
            const wallets: IHyconWallet[] = []
            for (const address of addresses) {
                const account = await this.getAddressInfo(address)
                wallets.push({
                    address,
                    balance: account.balance,
                    pendingAmount: account.pendingAmount,
                })
            }
            return wallets
        } catch (e) {
            console.log(`Fail to getLedgerWallet: ${e}`)
            return 1
        }
    }

    public async sendTxWithLedger(index: number, from: string, to: string, amount: string, fee: string, queueTx?: Function): Promise<{ res: boolean, case?: number }> {
        let status = 1
        try {
            const fromAddress = utils.addressToUint8Array(from)
            const toAddress = utils.addressToUint8Array(to)
            const addressInfo = await this.getAddressInfo(from)
            if (addressInfo.nonce < 0) {
                throw new Error("Nonce is not valid.")
            }
            status = 2
            let nonce: number
            if (addressInfo.pendings.length > 0) {
                nonce = addressInfo.pendings[addressInfo.pendings.length - 1].nonce + 1
            } else {
                nonce = addressInfo.nonce + 1
            }
            const iTx: proto.ITx = {
                from: fromAddress,
                to: toAddress,
                amount: utils.hyconfromString(amount),
                fee: utils.hyconfromString(fee),
                nonce,
            }
            const protoTx: Uint8Array = proto.Tx.encode(iTx).finish()
            const rawTxHex = bytesToHex(protoTx)
            const singed = ipcRenderer.sendSync("sign", { rawTxHex, index })

            if (!("signature" in singed)) { throw 2 }
            status = 3

            const signedTx = {
                signature: singed.signature,
                from,
                to,
                amount,
                fee,
                nonce,
                recovery: singed.recovery,
            }

            const result = await this.outgoingTx(signedTx)

            if (!("txHash" in result) || (typeof result.txHash) !== "string") {
                throw new Error("Fail to transfer hycon.")
            }

            return Promise.resolve({ res: true })
        } catch (e) {
            console.log(`error ${e}`)
            return { res: false, case: status }
        }
    }

    public getNextTxsInBlock(blockhash: string, txHash: string, index: number): Promise<ITxProp[]> {
        return Promise.resolve(
            fetch(`${this.url}/api/${this.apiVersion}/nextTxsInBlock/${blockhash}/${txHash}/${index}`)
                .then((response) => response.json())
                .catch((err: Error) => {
                    console.log(err)
                }),
        )
    }

    public createNewWallet(Hwallet: IHyconWallet): Promise<IHyconWallet | IResponseError> {
        const seed: Buffer = bip39.mnemonicToSeed(Hwallet.mnemonic, Hwallet.passphrase)
        const masterKey = HDKey.fromMasterSeed(seed)
        const wallet = masterKey.derive(`m/44'/${this.coinNumber}'/0'/0/0`)

        const address = utils.publicKeyToAddress(wallet.publicKey)

        const hyconWallet: IHyconWallet = {
            address: utils.addressToString(address),
        }
        return Promise.resolve(hyconWallet)
    }
    public getTOTP(): Promise<{ iv: string, data: string }> {
        return new Promise((resolve, _) => {
            this.totpDB.find({}, (err: Error, docs: Array<{ iv: string, data: string }>) => {
                if (err) {
                    console.error(err)
                    return false
                }
                if (docs.length === 0) {
                    return false
                }
                resolve({ iv: docs[0].iv, data: docs[0].data })
            })
        })
    }
    public async saveTOTP(secret: string, totpPw: string): Promise<boolean> {
        try {
            const iv = crypto.randomBytes(16)
            const key = Buffer.from(utils.blake2bHash(totpPw).buffer)
            const cipher = crypto.createCipheriv("aes-256-cbc", key, iv)
            const encryptedData = Buffer.concat([cipher.update(Buffer.from(secret)), cipher.final()])
            const store: { iv: string, data: string } = {
                iv: iv.toString("hex"),
                data: encryptedData.toString("hex"),
            }
            return new Promise<boolean>((resolve, _) => {
                this.totpDB.insert(store, (err: Error, doc: { iv: string, data: string }) => {
                    if (err) {
                        console.error(err)
                        resolve(false)
                    }
                    resolve(true)
                })
            })
        } catch (e) {
            console.error(e)
            return Promise.resolve(false)
        }
    }
    public async deleteTOTP(totpPw: string): Promise<{ res: boolean, case?: number }> {
        try {
            const totp = await this.getTOTP()

            const secret = this.decryptTOTP(totpPw, totp.iv, totp.data).toString()
            if (secret === "false") {
                return Promise.resolve({ res: false, case: 1 })
            }

            const key = Buffer.from(utils.blake2bHash(totpPw).buffer)
            const iv = Buffer.from(totp.iv, "hex")
            const cipher = crypto.createCipheriv("aes-256-cbc", key, iv)
            const encryptedData = Buffer.concat([cipher.update(Buffer.from(secret)), cipher.final()])

            if (totp.data === encryptedData.toString("hex")) {
                return new Promise<{ res: boolean, case?: number }>((resolve, _) => {
                    this.totpDB.remove({ iv: totp.iv }, {}, (err: Error, n: number) => {
                        if (err) {
                            console.error(err)
                            resolve({ res: false, case: 2 })
                        }
                        resolve({ res: true })
                    })
                })
            }
            return Promise.resolve({ res: false, case: 3 })
        } catch (e) {
            return Promise.resolve({ res: false, case: 3 })
        }
    }
    public async verifyTOTP(token: string, totpPw: string, secret?: string) {
        if (secret) {
            return new Promise<boolean>((resolve, _) => {
                const res = tfa.verifyToken(secret, token)
                if (res === null || res.delta !== 0) { resolve(false) }
                resolve(true)
            })
        }

        const totp = await this.getTOTP()
        return new Promise<boolean>((resolve, _) => {
            if (!totp) {
                console.error(`Fail to get Transaction OTP`)
                resolve(false)
            }
            const s = this.decryptTOTP(totpPw, totp.iv, totp.data).toString()
            const res = tfa.verifyToken(s, token)
            if (res === null || res.delta !== 0) { resolve(false) }
            resolve(true)
        })
    }
    public getWalletBalance(address: string): Promise<{ balance: string } | IResponseError> {
        throw new Error("getWalletBalance: Not Implemented")
    }

    public getWalletTransactions(address: string, nonce?: number): Promise<{ txs: ITxProp[] } | IResponseError> {
        throw new Error("getWalletTransactions: Not Implemented")
    }
    public getAllAccounts(name: string): Promise<{ represent: number, accounts: Array<{ address: string, balance: string }> } | boolean> {
        throw new Error("getAllAccounts not implemented")
    }

    public outgoingSignedTx(tx: { privateKey: string, to: string, amount: string, fee: string, nonce: number }, queueTx?: Function): Promise<{ txHash: string } | IResponseError> {
        throw new Error("outgoingSignedTx: Not Implemented")
    }

    public getPeerList(): Promise<IPeer[]> {
        throw new Error("getPeerList not implemented")
    }

    public getPeerConnected(index: number): Promise<{ peersInPage: IPeer[], pages: number }> {
        throw new Error("getPeerConnected not implemented")
    }
    public getBlock(hash: string): Promise<IBlock | IResponseError> {
        return Promise.resolve(
            fetch(`${this.url}/api/${this.apiVersion}/block/${hash}`)
                .then((response) => response.json())
                .catch((err: Error) => {
                    console.log(err)
                }),
        )
    }

    public getBlockList(index: number): Promise<{ blocks: IBlock[], length: number }> {
        throw new Error("getBlockList not implemented")
    }

    public getTopTipHeight(): Promise<{ height: number }> {
        throw new Error("getTopTipHeight not implemented")
    }

    public getMiner(): Promise<IMiner> {
        throw new Error("getMiner not implemented")
    }

    public setMiner(address: string): Promise<boolean> {
        throw new Error("setMiner not implemented")
    }

    public startGPU(): Promise<boolean> {
        throw new Error("startGPU not implemented")
    }

    public setMinerCount(count: number): Promise<void> {
        throw new Error("setMinerCount not implemented")
    }

    public possibilityLedger(): Promise<boolean> {
        return (this.osArch === "x64") ? Promise.resolve(true) : Promise.resolve(false)
    }

    private async getWallet(name: string) {
        return new Promise<IStoredWallet>((resolve, reject) => {
            this.walletsDB.findOne({ name }, (err: Error, doc: IStoredWallet) => {
                if (err) {
                    reject(err)
                    return
                }

                if (!doc) {
                    reject(new Error(`Wallet '${name}' not found`))
                    return
                }

                resolve(doc)
            })
        })
    }

    private decryptWallet(password: string, iv: string, data: string) {
        const ivBuffer = Buffer.from(iv, "hex")
        const dataBuffer = Buffer.from(data, "hex")
        const key = utils.blake2bHash(password)
        const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivBuffer)
        const originalData = Buffer.concat([decipher.update(dataBuffer), decipher.final()])
        return originalData
    }

    private decryptTOTP(totpPw: string, iv: string, data: string): Buffer | boolean {
        try {
            const key = Buffer.from(utils.blake2bHash(totpPw).buffer)
            const ivBuffer = Buffer.from(iv, "hex")
            const dataBuffer = Buffer.from(data, "hex")
            const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivBuffer)
            const originalData = Buffer.concat([decipher.update(dataBuffer), decipher.final()])
            return originalData
        } catch (e) {
            return false
        }
    }

    private checkDupleAddress(address: string): Promise<boolean> {
        return new Promise<boolean>((resolve, _) => {
            this.walletsDB.count({ address }, (err: Error, exist: number) => {
                if (err) {
                    console.error(err)
                    resolve(true)
                }

                exist ? resolve(true) : resolve(false)
            })
        })
    }
}
