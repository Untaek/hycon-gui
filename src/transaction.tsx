import { Dialog, DialogTitle } from "@material-ui/core"
import Button from "@material-ui/core/Button"
import CardContent from "@material-ui/core/CardContent"
import Grid from "@material-ui/core/Grid"
import Icon from "@material-ui/core/Icon"
import { Card, CircularProgress, TextField } from "material-ui"
import * as React from "react"
import { Redirect } from "react-router"
import { AddressBook } from "./addressBook"
import { IHyconWallet, IRest } from "./rest"
import { hyconfromString } from "./stringUtil"

export class Transaction extends React.Component<any, any> {
    public mounted = false

    constructor(props: any) {
        super(props)

        this.state = {
            address: "",
            amount: 0,
            dialog: false,
            dialog2: false,
            errorText: "",
            favorites: [],
            fromAddress: "",
            isLoading: false,
            minerFee: 1,
            name: props.name,
            password: "",
            pendingAmount: "0",
            piggyBank: "0",
            rest: props.rest,
            totp: false,
            totpPw: "",
            totpToken: "",
            wallets: [],
        }
        this.handleInputChange = this.handleInputChange.bind(this)
        this.handleSubmit = this.handleSubmit.bind(this)
        this.handleCancel = this.handleCancel.bind(this)
    }
    public componentWillUnmount() {
        this.mounted = false
    }
    public componentDidMount() {
        this.mounted = true
        this.state.rest.setLoading(true)
        this.state.rest.getWalletDetail(this.state.name)
            .then((data: IHyconWallet) => {
                this.state.rest.setLoading(false)
                if (this.mounted) {
                    this.setState({ wallet: data, piggyBank: data.balance, fromAddress: data.address, pendingAmount: data.pendingAmount })
                }
            })
        this.state.rest.getFavoriteList()
            .then((data: Array<{ alias: string, address: string }>) => {
                this.state.rest.setLoading(false)
                if (this.mounted) { this.setState({ favorites: data }) }
            })
        this.state.rest.getTOTP().then((result: boolean) => {
            if (result) {
                this.setState({ totp: true })
            } else {
                this.setState({ totp: false })
            }
        })
    }

    public handlePassword(data: any) {
        this.setState({ password: data.target.value })
    }

    public handleInputChange(event: any) {
        const name = event.target.name
        const value = event.target.value
        this.setState({ [name]: value })
    }

    public checkInputs(event: any) {
        const pattern = /(^[0-9]*)([.]{0,1}[0-9]{0,9})$/
        if (this.state.amount <= 0) {
            alert(`${this.props.language["alert-enter-valid-amount"]}`)
            return
        }
        if (this.state.amount.match(pattern) == null) {
            alert(`${this.props.language["alert-decimal-overflow"]}`)
            return
        }
        if (hyconfromString(this.state.amount).add(hyconfromString(this.state.minerFee)).greaterThan(hyconfromString(this.state.piggyBank).sub(hyconfromString(this.state.pendingAmount)))) {
            alert(`${this.props.language["alert-insufficient-funds"]}`)
            return
        }
        if (hyconfromString(this.state.minerFee).compare(hyconfromString("0")) === 0) {
            alert(`${this.props.language["alert-miner-fee"]}`)
            return
        }
        if (this.state.fromAddress === this.state.address) {
            alert(`${this.props.language["alert-cannot-send-self"]}`)
            return
        }
        if (this.state.address === "" || this.state.address === undefined) {
            alert(`${this.props.language["alert-address-empty"]}`)
            return
        }
        return true
    }

    public async handleSubmit(event: any) {
        if (this.state.totp) {
            const res = await this.state.rest.verifyTOTP(this.state.totpToken, this.state.totpPw)
            if (!res) { alert(this.props.language["alert-invalid-code-password"]); return }
        }

        this.setState({ isLoading: true })

        this.state.rest.sendTx({ name: this.state.name, password: this.state.password, address: this.state.address, amount: this.state.amount.toString(), minerFee: this.state.minerFee.toString() })
            .then((result: { res: boolean, case?: number }) => {
                if (result.res === true) {
                    alert(`${this.props.language["alert-send-success"]}\n- ${this.props.language["send-amount"]}: ${this.state.amount}\n- ${this.props.language.fees}: ${this.state.minerFee}\n- ${this.props.language["to-address"]}: ${this.state.address}`)
                    this.setState({ redirect: true })
                } else if (result.case === 1) {
                    alert(`${this.props.language["alert-invalid-address-to"]}`)
                    this.setState({ isLoading: false })
                } else if (result.case === 2) {
                    alert(`${this.props.language["alert-invalid-password"]}`)
                    this.setState({ isLoading: false, password: "" })
                } else if (result.case === 3) {
                    alert(`${this.props.language["alert-send-failed"]}`)
                    this.setState({ redirect: true })
                }
            })

        event.preventDefault()
    }

    public handleCancel(event: any) {
        this.setState({ redirect: true })
    }

    public render() {
        if (this.state.redirect) {
            return <Redirect to={`/wallet/detail/${this.state.name}`} />
        }
        if (this.state.wallet === undefined && !this.state.selectFrom) { return <div></div> }
        return (
            <div style={{ width: "60%", margin: "auto" }}>
                <Card>
                    <CardContent>
                        <div style={{ textAlign: "center" }}>
                            <h3 style={{ color: "grey" }}><Icon style={{ transform: "rotate(-25deg)", marginRight: "10px", color: "grey" }}>send</Icon>{this.props.language["send-transaction"]}</h3><br />
                            <Grid container direction={"row"} justify={"flex-end"} alignItems={"flex-end"}>
                                <Button variant="raised" onClick={() => { this.setState({ dialog: true }) }} style={{ backgroundColor: "#f2d260", color: "white", float: "right", margin: "0 10px" }}>
                                    <Icon>bookmark</Icon><span style={{ marginLeft: "5px" }}>{this.props.language["address-book"]}</span>
                                </Button>
                            </Grid>
                            <TextField style={{ width: "330px" }} floatingLabelFixed={true} floatingLabelText={this.props.language["from-address"]} type="text" disabled={true} value={this.state.fromAddress} />
                            <TextField name="address" floatingLabelFixed={true} style={{ marginLeft: "30px", width: "330px" }} floatingLabelText={this.props.language["to-address"]} type="text" value={this.state.address} onChange={this.handleInputChange} />
                            <br />
                            <TextField style={{ width: "330px" }} floatingLabelFixed={true} floatingLabelText={this.props.language["total-amount"]} type="text" disabled={true} value={this.state.piggyBank} />
                            <TextField style={{ marginLeft: "30px", width: "330px" }} name="amount" floatingLabelFixed={true} floatingLabelText={this.props.language.amount} type="text" value={this.state.amount} max={this.state.piggyBank} onChange={this.handleInputChange} />
                            <br />
                            <TextField floatingLabelText={this.props.language["wallet-pending"]} floatingLabelFixed={true} style={{ width: "330px" }} type="text" disabled={true} value={this.state.pendingAmount} />
                            <TextField name="minerFee" floatingLabelFixed={true} style={{ marginLeft: "30px", width: "330px" }} floatingLabelText={this.props.language.fees} type="text" value={this.state.minerFee} onChange={this.handleInputChange} />
                            <br />
                            <TextField name="password" value={this.state.password} floatingLabelFixed={true} style={{ marginRight: "20px", width: "330px" }} floatingLabelText={this.props.language.password} type="password" autoComplete="off" onChange={(data) => { this.handlePassword(data) }} />
                            <br /><br />
                            <Grid container direction={"row"} justify={"center"} alignItems={"center"}>
                                <Button variant="raised" onClick={this.handleCancel} style={{ backgroundColor: "rgb(225, 0, 80)", color: "white", float: "right" }}>{this.props.language["button-cancel"]}</Button>
                                {this.state.totp
                                ? (<Button variant="raised" style={{ backgroundColor: "#50aaff", color: "white", float: "right", margin: "0 10px" }}
                                    onClick={(event) => { if (this.checkInputs(event)) { this.setState({ dialog2: true }) } }}>{this.props.language.totp}</Button>)
                                : (<Button variant="raised" style={{ backgroundColor: "#50aaff", color: "white", float: "right", margin: "0 10px" }}
                                    onClick={(event) => { if (this.checkInputs(event)) { this.handleSubmit(event) } }} >{this.props.language["button-transfer"]}</Button>)
                                }
                            </Grid>
                        </div>
                    </CardContent>
                </Card >

                {/* ADDRESS BOOK */}
                <Dialog open={this.state.dialog} onClose={() => { this.setState({ dialog: false }) }}>
                    <AddressBook rest={this.state.rest} favorites={this.state.favorites} isWalletView={false} language={this.props.language} callback={(address: string) => { this.handleListItemClick(address) }} />
                </Dialog>

                {/* LOADING */}
                <Dialog open={this.state.isLoading} aria-labelledby="alert-dialog-title" aria-describedby="alert-dialog-description" >
                    <div style={{ textAlign: "center" }}>
                        <CircularProgress style={{ marginRight: "5px" }} size={50} thickness={2} /> {this.props.language.loading}
                    </div>
                </Dialog>

                {/* GOOGLE TRANSACTION OTP */}
                <Dialog style={{ textAlign: "center" }} open={this.state.dialog2} onClose={() => { this.setState({ dialog2: false }) }}>
                    <DialogTitle id="simple-dialog-title">{this.props.language.totp}</DialogTitle>
                    <div style={{ margin: "2em" }}>
                        <p>{this.props.language["transaction-totp"]}</p>
                        <TextField floatingLabelText={this.props.language["totp-google-code"]} autoComplete="off"
                            errorText={this.state.errorText} errorStyle={{ float: "left" }}
                            value={this.state.totpToken}
                            onChange={(data) => { this.handleTOTP(data) }} /><br />
                        <TextField floatingLabelText={this.props.language["totp-otp-password"]} type="password" autoComplete="off"
                            value={this.state.totpPw}
                            onChange={(data) => { this.handleTOTPpassword(data) }} /><br /><br />
                        <Grid container direction={"row"} justify={"center"} alignItems={"center"}>
                            <Button variant="raised" onClick={() => { this.setState({ dialog2: false }) }} style={{ backgroundColor: "rgb(225, 0, 80)", color: "white" }}>{this.props.language["button-cancel"]}</Button>
                            <Button variant="raised" onClick={this.handleSubmit} style={{ backgroundColor: "#50aaff", color: "white", margin: "0 10px" }}>{this.props.language["button-transfer"]}</Button>
                        </Grid>
                    </div>
                </Dialog>
            </div >
        )
    }
    private handleListItemClick(toAddr: string) {
        this.setState({ address: toAddr, dialog: false })
    }
    private handleTOTP(data: any) {
        const patternSixDigits = /^[0-9]{6}$/
        this.setState({ totpToken: data.target.value })
        if (!patternSixDigits.test(data.target.value)) {
            this.setState({ errorText: this.props.language["alert-six-digit"] })
        } else {
            this.setState({ errorText: "" })
        }
    }
    private handleTOTPpassword(data: any) {
        this.setState({ totpPw: data.target.value })
    }
}
