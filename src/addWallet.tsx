import { Button, CardContent, Checkbox, FormControl, FormControlLabel, Grid, Icon, Input, InputLabel, MenuItem, Select, Step, StepLabel, Stepper } from "@material-ui/core"
import { Card, Dialog, IconButton, TextField } from "material-ui"
import * as React from "react"
import { Redirect } from "react-router"
import { encodingMnemonic } from "./stringUtil"

export class AddWallet extends React.Component<any, any> {
    public mounted: boolean = false
    public errMsg1: string = `${this.props.language["alert-empty-fields"]}`
    public errMsg2: string = `${this.props.language["alert-invalid-wallet"]}`
    public errMsg3: string = `${this.props.language["password-not-matched"]}`
    public errMsg4: string = `${this.props.language["title-check-mnemonic"]}`
    public errMsg5: string = `${this.props.language["title-check-mnemonic"]}`
    public errMsg6: string = `${this.props.language["alert-duplicate-wallet"]}`
    public pattern1 = /^[a-zA-Z0-9\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF]{2,20}$/
    constructor(props: any) {
        super(props)
        this.state = {
            activeStep: 0,
            advanced: false,
            confirmMnemonic: "",
            dialog: false,
            errorText1: "",
            language: "",
            languages: ["English", "Korean", "Chinese - Simplified", "Chinese - Traditional", "Japanese", "French", "Spanish", "Italian"],
            load: false,
            mnemonic: "",
            name: "",
            passphrase1: "",
            password1: "",
            password2: "",
            redirect: false,
            rest: props.rest,
            selectedOption: "English",
            typedMnemonic: "",
        }
        this.handleOptionChange = this.handleOptionChange.bind(this)
        this.cancelWallet = this.cancelWallet.bind(this)
        this.handleNext = this.handleNext.bind(this)
    }

    public componentDidMount() {
        this.setState({ load: true })
    }

    public handleName(data: any) {
        this.setState({ name: data.target.value })
    }
    public handlePassword(data: any) {
        if (this.state.password2 !== "") {
            if (data.target.value === this.state.password2) {
                this.setState({ errorText1: "" })
            } else {
                this.setState({ errorText1: `${this.props.language["password-not-matched"]}` })
            }
        } else if (data.target.value === "") {
            if (data.target.value === this.state.password2) { this.setState({ errorText1: "" }) }
        }
        this.setState({ password1: data.target.value })
    }
    public handleConfirmPassword(data: any) {
        if (this.state.password1 !== "") {
            if (data.target.value === this.state.password1) {
                this.setState({ errorText1: "" })
            } else {
                this.setState({ errorText1: `${this.props.language["password-not-matched"]}` })
            }
        } else if (data.target.value === "") {
            if (data.target.value === this.state.password1) { this.setState({ errorText1: "" }) }
        }
        this.setState({ password2: data.target.value })
    }
    public handleCheckbox(event: any) {
        if (event.target.checked === false) { this.setState({ passphrase1: "" }) }
        this.setState({ advanced: event.target.checked })
    }
    public handlePassphrase(data: any) {
        this.setState({ passphrase1: data.target.value })
    }

    public handleConfirmMnemonic(data: any) {
        this.setState({ confirmMnemonic: data.target.value })
    }
    public handleTypeMnemonic(data: any) {
        this.setState({ typedMnemonic: data.target.value })
    }
    public handleOptionChange(option: any) {
        this.setState({ selectedOption: option.target.value })
    }
    public handleNext() {
        switch (this.state.activeStep) {
            case 0:
                if (this.state.passphrase1 !== "") {
                    if (confirm(`${this.props.language["bip39-warning"]}`)) { this.receiveMnemonic() }
                } else { this.receiveMnemonic() }
                break
            case 1:
                this.checkConfirmMnemonic()
                break
            case 2:
                this.createWallet()
                break
            default:
                break
        }
    }
    public receiveMnemonic() {
        if (this.state.name === "") {
            alert(this.errMsg1)
        } else if (this.state.name.search(/\s/) !== -1 || !this.pattern1.test(this.state.name)) {
            alert(this.errMsg2)
        } else {
            if (this.state.password1 !== this.state.password2) {
                alert(this.errMsg3)
            } else {
                this.state.rest.setLoading(true)
                this.state.rest.checkDupleName(this.state.name).then((result: boolean) => {
                    if (result) {
                        alert(this.errMsg6)
                    } else {
                        let opt = this.state.selectedOption
                        if (opt === "Chinese - Traditional") {
                            opt = "chinese_traditional"
                        } else if (opt === "Chinese - Simplified") { opt = "chinese_simplified" }
                        this.state.rest.getMnemonic(opt).then((data: string) => {
                            this.state.rest.setLoading(false)
                            this.setState({ mnemonic: data, language: opt, activeStep: this.state.activeStep + 1 })
                        })
                    }
                })
            }
        }
    }
    public checkConfirmMnemonic() {
        if (this.state.confirmMnemonic === "") {
            alert(this.errMsg5)
        } else {
            const mnemonicString = encodingMnemonic(this.state.mnemonic)
            const confirmMnemonicString = encodingMnemonic(this.state.confirmMnemonic)
            if (this.state.mnemonic === confirmMnemonicString) {
                this.setState({ activeStep: this.state.activeStep + 1 })
            } else {
                alert(this.errMsg4)
            }
        }
    }
    public createWallet() {
        if (this.state.typedMnemonic === "") {
            alert(this.errMsg5)
        } else {
            const mnemonicString = encodingMnemonic(this.state.mnemonic)
            const typedMnemonicString = encodingMnemonic(this.state.typedMnemonic)
            if (mnemonicString === typedMnemonicString) {
                this.state.rest.generateWallet({
                    hint: this.state.hint,
                    language: this.state.language,
                    mnemonic: this.state.mnemonic,
                    name: this.state.name,
                    passphrase: this.state.passphrase1,
                    password: this.state.password1,
                }).then((data: string) => {
                    this.setState({ walletViewRedirect: true, address: data })
                })
            } else {
                alert(this.errMsg4)
            }
        }
    }
    public cancelWallet() {
        this.setState({ redirect: true })
    }
    public render() {
        const steps = [`${this.props.language["title-wallet-info"]}`, `${this.props.language["title-receive-mnemonic"]}`, `${this.props.language["title-check-mnemonic"]}`]

        if (this.state.redirect) {
            return <Redirect to="/wallet" />
        }
        if (this.state.walletViewRedirect) {
            return <Redirect to={`/wallet/detail/${this.state.name}`} />
        }
        if (!this.state.load) {
            return <div></div>
        }
        return (
            <div style={{ textAlign: "center", width: "80%", margin: "auto" }}>
                <Grid container direction={"row"} justify={"center"} alignItems={"center"} style={{ display: "inline-block" }}>
                    <Stepper style={{ marginBottom: "2%" }} activeStep={this.state.activeStep}>
                        {steps.map((label, index) => (<Step key={index}><StepLabel>{label}</StepLabel></Step>))}
                    </Stepper>
                </Grid>
                <Card>
                    <CardContent>
                        <div style={{ display: `${this.state.activeStep === 0 ? ("block") : ("none")}` }}>
                            <TextField style={{ marginRight: "3%" }} floatingLabelText={this.props.language["wallet-name"]} floatingLabelFixed={true} autoComplete="off"
                                value={this.state.walletName}
                                onChange={(data) => { this.handleName(data) }}
                                onKeyPress={(event) => { if (event.key === "Enter") { event.preventDefault(); this.handleNext() } }}
                            />
                            <FormControl style={{ width: "256px", marginTop: "1.5%" }}>
                                <InputLabel htmlFor="language">{this.props.language["mnemonic-language"]}</InputLabel>
                                <Select value={this.state.selectedOption} onChange={this.handleOptionChange} input={<Input name="language" />}>
                                    {this.state.languages.map((lang: string) => {
                                        return (
                                            <MenuItem key={lang} value={lang}>{lang}</MenuItem>
                                        )
                                    })}
                                </Select>
                            </FormControl><br />
                            <TextField style={{ marginRight: "3%" }} floatingLabelText={this.props.language["password-encrypt"]} floatingLabelFixed={true} type="password" autoComplete="off" name="pw1"
                                value={this.state.password1}
                                onChange={(data) => { this.handlePassword(data) }}
                                onKeyPress={(event) => { if (event.key === "Enter") { event.preventDefault(); this.handleNext() } }}
                            />
                            <TextField floatingLabelText={this.props.language["password-confirm"]} floatingLabelFixed={true} type="password" autoComplete="off" name="pw2"
                                errorText={this.state.errorText1} errorStyle={{ float: "left" }}
                                value={this.state.password2}
                                onChange={(data) => { this.handleConfirmPassword(data) }}
                                onKeyPress={(event) => { if (event.key === "Enter") { event.preventDefault(); this.handleNext() } }}
                            /><br />
                            <br />
                            <br />
                            <span style={{ display: "inline-flex" }}>
                                <FormControlLabel style={{ margin: "auto" }}
                                    label={this.props.language["advanced-option"]}
                                    control={<Checkbox color="primary" checked={this.state.advanced} onChange={(event) => this.handleCheckbox(event)} />}
                                />
                                <IconButton iconStyle={{ color: "grey", fontSize: "large" }} onClick={() => { this.setState({ dialog: true }) }}><Icon>help_outline</Icon></IconButton>
                            </span>
                            {(this.state.advanced)
                                ? (<div>
                                    <TextField floatingLabelText={this.props.language["bip39-prompt"]} floatingLabelFixed={true} autoComplete="off" name="pp1"
                                        value={this.state.passphrase1}
                                        onChange={(data) => { this.handlePassphrase(data) }}
                                        onKeyPress={(event) => { if (event.key === "Enter") { event.preventDefault(); this.handleNext() } }}
                                    /><br />
                                </div>)
                                : (<div></div>)
                            }
                            <br />
                        </div>
                        <div style={{ display: `${this.state.activeStep === 1 ? ("block") : ("none")}` }}>
                            <h4 style={{ color: "grey", marginBottom: "0%" }}>{this.props.language["mnemonic-title1"]}</h4>
                            <div style={{ color: "red", fontSize: "11px" }}>{this.props.language["mnemonic-subtitle"]}</div>
                            <br /><br />
                            <div style={{ fontWeight: "bold" }}>{this.state.mnemonic}</div>
                            <Input style={{ border: "none", borderBottom: "0.5px solid", width: "53%" }} placeholder="Please type mnemonic phrase above" autoComplete="off"
                                onChange={(data) => { this.handleConfirmMnemonic(data) }} onPaste={(e) => { e.preventDefault() }}
                                onKeyPress={(event) => { if (event.key === "Enter") { event.preventDefault(); this.handleNext() } }}
                            />
                        </div>
                        <div style={{ display: `${this.state.activeStep === 2 ? ("block") : ("none")}` }}>
                            <h4 style={{ color: "grey", marginBottom: "0%" }}>{this.props.language["mnemonic-title2"]}</h4>
                            <br /><br />
                            <Input style={{ border: "none", borderBottom: "0.5px solid", width: "53%" }} placeholder="Please type one more time to confirm mnemonic phrase" autoComplete="off"
                                onChange={(data) => { this.handleTypeMnemonic(data) }} onPaste={(e) => { e.preventDefault() }}
                                onKeyPress={(event) => { if (event.key === "Enter") { event.preventDefault(); this.handleNext() } }}
                            />
                        </div>
                    </CardContent>
                </Card>
                <br /><br />
                <Grid container direction={"row"} justify={"center"} alignItems={"center"} style={{ display: "inline-block", width: "80%" }}>
                    <Button onClick={this.cancelWallet}>{this.props.language["button-cancel"]} <Icon style={{ fontSize: "17px" }}>close</Icon></Button>
                    <Button onClick={this.handleNext} >
                        {this.state.activeStep === steps.length - 1 ? `${this.props.language["button-submit"]}` : `${this.props.language["button-next"]}`}
                        {this.state.activeStep === steps.length - 1 ? (<Icon style={{ fontSize: "20px" }}>check</Icon>) : (<Icon style={{ fontSize: "20px" }}>chevron_right</Icon>)}
                    </Button>
                </Grid>

                {/* HELP - ADVANCED OPTIONS */}
                <Dialog className="dialog" open={this.state.dialog} contentStyle={{ width: "70%", maxWidth: "none" }}>
                    <h3 style={{ color: "grey" }}>{this.props.language["advanced-option-tooltip-title"]}</h3>
                    <div className="mdl-dialog__content dialogContent">{this.props.language["advanced-option-tooltip1"]}<br /><strong>{this.props.language["advanced-option-tooltip2"]}</strong></div><br />
                    <Grid container direction={"row"} justify={"center"} alignItems={"center"}>
                        <Button variant="raised" style={{ backgroundColor: "rgb(225, 0, 80)", color: "white", margin: "0 10px" }} onClick={() => { this.setState({ dialog: false }) }}>{this.props.language["button-close"]}</Button>
                    </Grid>
                </Dialog>
            </div >
        )
    }
}
