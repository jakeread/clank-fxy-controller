/*
osap-local

example of a standalone local script,
having some links, one to start...
maybe ahn serialport apres

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

// big s/o to https://github.com/standard-things/esm for allowing this
import OSAP from '../core/osap.js'
import child_process from 'child_process'

import { TS } from '../core/ts.js'

// we include an osap object - a node
let osap = new OSAP()
osap.name = "local sub-sub"
let parentVPort = osap.vPort() // yeah, go this
parentVPort.name = 'lsubsub child port'

console.log('OSAPL SUBSUB: Hello World')

parentVPort.phy.open = () => { return true }
parentVPort.phy.maxSegLength = 1024

let LOGPHY = false

process.on('message', (msg) => {
  if(LOGPHY) console.log('SUBSUB RECV', msg)
  parentVPort.phy.receive(msg)
})

parentVPort.phy.send = (buf) => {
  process.send(buf)
}

//process.send(Uint8Array.from([57,56,55]))
