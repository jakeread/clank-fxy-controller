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
osap.name = "local sub"
let parentVPort = osap.vPort() // yeah, go this
parentVPort.name = "lsub child port"

console.log('OSAPL SUB: Hello World')

parentVPort.phy.open = () => { return true }
parentVPort.phy.maxSegLength = 1024

let LOGPHY = false

process.on('message', (msg) => {
  if(LOGPHY) console.log('OSAPL SUB RECV', msg)
  parentVPort.phy.receive(msg)
})

parentVPort.phy.send = (buf) => {
  process.send(buf)
}

// we are sub, with parentVPort to parent, subsubVPort to subsub ...

// sub-sub, jeez

let subsubVPort = osap.vPort()
subsubVPort.name = "lsub parent port"

let subsub = child_process.fork('local/osapl-subsub', ['-r', 'esm'], {
  serialization: 'advanced', // do this to get *native* objects, tho they are still serialized inside of this thing
  silent: true,
})

// logging:
subsub.stdout.on('data', (msg) => {
  console.log('SUBSUB LOG: ', msg.toString())
})
subsub.stderr.on('data', (err) => {
  console.log('SUBSUB ERR: ', err.toString())
})

console.log('SUBSUB ALIVE')
subsubVPort.phy.open = () => { return true }
subsubVPort.phy.maxSegLength = 1024
subsub.on('message', (data) => {
  subsubVPort.phy.receive(data)
})
subsubVPort.phy.send = (buf) => {
  subsub.send(buf)
}

subsub.on('error', (err) => {
  console.log('subsub err', err)
})
subsub.on('close', (code) => {
  console.log('subsub closes', code)
})
