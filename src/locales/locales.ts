import english from "./en"
import japanese from "./ja"
import korean from "./kr"
import mongolian from "./mn"
import russian from "./ru"
import vietnamese from "./vi"
import chinese_simplified from "./zh-cn"
import chinese_traditional from "./zh-hk"

export function getLocale(code: string): IText {
    const locale = code.split("-")
    switch (locale[0]) {
        case "en":
            return english
            break
        case "ko":
            return korean
            break
        case "zh":
            if (locale[1] === "cn") {
                return chinese_simplified
                break
            } else {
                return chinese_traditional
                break
            }
            break
        case "vi":
            return vietnamese
            break
        case "ru":
            return russian
            break
        case "mn":
            return mongolian
            break
        case "ja":
            return japanese
            break
        default:
            return english
            break
    }
}
export interface IText {
    "button-cancel": string,
    "button-next": string,
    "button-recover": string,
    "button-previous": string,
    "button-claim": string,
    "button-transfer": string,
    "button-forget": string,
    "button-close": string,
    "button-submit": string,

    "wallet-list": string,
    "load-key-from-file": string,
    "title-add-wallet": string,
    "subtitle-add-wallet": string,

    "address-book": string,
    "address-empty": string,
    "address-placeholder": string,
    "alert-delete-address": string,
    "alert-delete-success": string,
    "alert-delete-failed": string,
    "alert-address-field-empty": string,
    "alert-add-sucess": string,
    "alert-add-failed": string,
    "alert-complete-claim": string,

    "add-wallet": string,
    "alert-invalid-wallet": string,
    "alert-invalid-mnemonic": string,
    "alert-empty-fields": string,
    "alert-duplicate-wallet": string,
    "alert-duplicate-address": string,
    "title-wallet-info": string,
    "title-receive-mnemonic": string,
    "title-check-mnemonic": string,
    "wallet-name": string,
    "mnemonic-title1": string,
    "mnemonic-title2": string,
    "mnemonic-subtitle": string,
    "mnemonic-language": string,
    "password-encrypt": string,
    "password-confirm": string,
    "password-not-matched": string,
    "advanced-option": string,
    "advanced-option-tooltip-title": string,
    "advanced-option-tooltip1": string,
    "advanced-option-tooltip2": string,
    "advanced-option-tooltip3": string,
    "bip39-prompt": string,
    "bip39-confirm": string,
    "bip39-not-matched": string,
    "bip39-warning": string,

    "wallet-details": string,
    "hycon-address": string,
    "wallet-pending": string,
    "summary": string,
    "final-balance": string,
    "load-more": string,
    "block-hash": string,
    "miner-address": string,
    "fee-reward": string,
    "mine-reward": string,
    "timestamp": string,
    "transaction": string,
    "confirmations": string,
    "received-time": string,
    "blocks-included": string,
    "fees": string,
    "total-count": string,
    "amount": string,
    "total-amount": string,
    "total-fee": string,
    "no-inputs": string,
    "wallet-address": string,
    "wallet-balance": string,
    "wallet-select": string,
    "ledger-view": string,
    "ledger-wallet": string

    "email": string,
    "password": string,
    "alert-invalid-login": string,
    "alert-invalid-2fa": string,
    "alert-tx-sent": string,
    "login": string,
    "2fa-prompt": string,
    "confirm-mnemonic": string,

    "send-transaction": string,
    "bookmark": string,
    "from-address": string,
    "to-address": string,
    "loading": string,
    "alert-send-success": string,
    "alert-enter-valid-amount": string,
    "alert-decimal-overflow": string,
    "alert-insufficient-funds": string,
    "alert-miner-fee": string,
    "alert-cannot-send-self": string,
    "alert-address-empty": string,
    "alert-invalid-from-addr": string,
    "alert-invalid-address-from": string,
    "alert-invalid-address-to": string,
    "alert-load-address-failed": string,
    "alert-txpool-failed": string,
    "alert-invalid-password": string,
    "alert-invalid-address": string,
    "alert-send-failed": string,
    "wallet-type-select": string,
    "local-wallet": string,
    "Hardware-wallet": string,
    "alert-try-again": string,
    "alert-ledger-sign-failed": string,
    "alert-ledger-connect-failed": string,
    "alert-select-account": string,
    "send-amount": string,

    "recover-wallet": string,
    "title-recover-wallet": string,
    "mnemonic-phrase": string,

    "totp": string,
    "totp-google-code": string,
    "totp-otp-password": string,
    "totp-confirm-otp-password": string,
    "enable-totp": string,
    "enable-totp-tip1": string,
    "enable-totp-tip2": string,
    "enable-totp-tip3": string,
    "alert-six-digit": string,
    "alert-invalid-google-code": string,
    "alert-enable-totp-fail": string,
    "alert-enable-totp-success": string,
    "disable-totp": string,
    "disable-totp-tip1": string,
    "disable-totp-tip2": string,
    "disable-totp-tip3": string,
    "alert-disable-totp-delete-fail": string,
    "alert-disable-totp-fail": string,
    "transaction-totp": string,
    "alert-invalid-code-password": string,
}
