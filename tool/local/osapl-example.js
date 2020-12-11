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
import WSSPipe from './common/wssPipe.js'

import child_process from 'child_process'

import SerialPipe from './common/serialPortCOBSPipe.js'
import SerialPort from 'serialport'
import Delimiter from '@serialport/parser-delimiter'
import ByteLength from '@serialport/parser-byte-length'

import COBS from './common/cobs.js'

import { TS } from '../core/ts.js'

let LOGPHY = false

// we include an osap object - a node
let osap = new OSAP()
osap.name = "local"
osap.description = "node-js instance, likely serving wss to browser"
// and we configure taht to have one new port,
// in this case, it will be a websocket server
let wssVPort = osap.vPort() // yeah, go this
wssVPort.name = "websocket server"
//let serialPortVPort = osap.vPort()

console.log('OSAPL Hello World')

// virtual routing, etc, is part of the core/osap include,
// but we need to set it up with handles to this particular websocket server.
WSSPipe.start().then((ws) => {
  wssVPort.phy.send = (buffer) => {
    if(LOGPHY) console.log('PHY WSS Send')
    if(LOGPHY) TS.logPacket(buffer)
    ws.send(buffer)
  }
  // later, not unlikely to run keep alive
  let isAlive = true
  wssVPort.phy.open = () => {
    return isAlive
  }
  // 'common node highwatermark'
  // https://nodejs.org/es/docs/guides/backpressuring-in-streams/
  wssVPort.phy.maxSegLength = 16384
  ws.onmessage = (msg) => {
    if(LOGPHY) console.log('PHY WSS Recv')
    if(LOGPHY) TS.logPacket(msg.data)
    wssVPort.phy.receive(msg.data)
  }
  ws.onerror = (err) => {
    wssVPort.phy.send = () => {}
    isAlive = false
    console.log('wss error', err)
  }
  ws.onclose = (evt) => {
    wssVPort.phy.send = () => {}
    isAlive = false
    // because this local script is remote-kicked,
    // we shutdown when the connection is gone
    console.log('wss closes, exiting')
    process.exit()
    // were this a standalone network node, this would not be true
  }
})

// make the second hop,

let parentVPort = osap.vPort()
parentVPort.name = "local parent port"

// also want to start another sub-sub ...
let sub = child_process.fork('local/osapl-sub', ['-r', 'esm'], {
  serialization: 'advanced', // do this to get *native* objects, tho they are still serialized inside of this thing
  silent: true,
})

sub.stdout.on('data', (msg) => {
  console.log('SUB LOG: ', msg.toString())
})
sub.stderr.on('data', (err) => {
  console.log('SUB ERR: ', err.toString())
})

console.log('SUB ALIVE')
parentVPort.phy.open = () => { return true }
parentVPort.phy.maxSegLength = 1024
sub.on('message', (data) => {
  if(LOGPHY) console.log('PARENT RECV', data)
  parentVPort.phy.receive(data)
})
parentVPort.phy.send = (buf) => {
  sub.send(buf)
}

//sub.send(Uint8Array.from([60,59,58]))

sub.on('error', (err) => {
  console.log('sub err', err)
})
sub.on('close', (code) => {
  console.log('sub closes', code)
})
