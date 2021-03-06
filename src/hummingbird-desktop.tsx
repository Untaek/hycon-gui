import getMuiTheme from "material-ui/styles/getMuiTheme"
import MuiThemeProvider from "material-ui/styles/MuiThemeProvider"
import * as React from "react"
import * as ReactDOM from "react-dom"
import { HashRouter } from "react-router-dom"
import { LiteClient } from "./liteclient"
import { RestElectron } from "./restElectron"

import "material-design-lite"
import "material-design-lite/material.css"
import "./blockexplorer.css"
import "./marker.css"
import "./material.css"
import "./transaction.css"

const rest = new RestElectron()

ReactDOM.hydrate(
    <MuiThemeProvider muiTheme={getMuiTheme()}>
        <HashRouter>
            <LiteClient rest={rest} />
        </HashRouter>
    </MuiThemeProvider>,
    document.getElementById("blockexplorer"),
)
