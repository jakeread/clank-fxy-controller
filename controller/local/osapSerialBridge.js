/*
osap-usb-bridge.js

osap bridge to firmwarelandia

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

// big s/o to https://github.com/standard-things/esm for allowing this
import OSAP from '../osapjs/core/osapRoot.js'
import { TS, PK, TIMES } from '../osapjs/core/ts.js'

import WSSPipe from './utes/wssPipe.js'
import VPortSerial from '../osapjs/vport/vPortSerial.js'

import { SerialPort } from 'serialport'

// we include an osap object - a node
let osap = new OSAP()
osap.name = "local-usb-bridge"
osap.description = "node featuring wss to client and usbserial cobs connection to hardware"

// -------------------------------------------------------- WSS VPort

let wssVPort = osap.vPort("wssVPort")   // 0

// then resolves with the connected webSocketServer to us 
let LOGWSSPHY = false 
wssVPort.maxSegLength = 16384
WSSPipe.start().then((ws) => {
  // no loop or init code, 
  // implement status 
  let status = "open"
  wssVPort.cts = () => {
    if (status == "open") {
      return true
    } else {
      return false
    }
  }
  // implement rx,
  ws.onmessage = (msg) => {
    if (LOGWSSPHY) console.log('PHY WSS Recv')
    if (LOGWSSPHY) TS.logPacket(msg.data)
    wssVPort.receive(msg.data)
  }
  // implement transmit 
  wssVPort.send = (buffer) => {
    if (LOGWSSPHY) console.log('PHY WSS Send')
    if (LOGWSSPHY) PK.logPacket(buffer)
    ws.send(buffer)
  }
  // local to us, 
  ws.onerror = (err) => {
    status = "closed"
    console.log('wss error', err)
  }
  ws.onclose = (evt) => {
    status = "closed"
    // because this local script is remote-kicked,
    // we shutdown when the connection is gone
    console.log('wss closes, exiting')
    process.exit()
    // were this a standalone network node, this would not be true
  }
})

// -------------------------------------------------------- USB Serial VPort

// we'd like to periodically poke around and find new ports... 
let pidCandidates = [
  '801E', '80CB', '8031', '80CD', '800B', '801C'
]
let activePorts = []
let portSweeper = () => {
  SerialPort.list().then((ports) => {
    for(let port of ports){
      let cand = pidCandidates.find(elem => elem == port.productId)
      if(cand && !activePorts.find(elem => elem.portName == port.path)){ 
        // we have a match, but haven't already opened this port, 
        console.log(`FOUND desired prt at ${port.path}, launching vport...`)
        activePorts.push(new VPortSerial(osap, port.path))
        console.log(activePorts)
      }
    }
    // also... check deadies, 
    for(let vp of activePorts){
      if(vp.status == "closed"){
        console.log(`CLOSED and rming ${vp.portName}`)
        console.log('at indice...', activePorts.findIndex(elem => elem == vp))
        activePorts.splice(activePorts.findIndex(elem => elem == vp), 1)
        console.log(activePorts)
      }
    }
    // set a timeout, 
    setTimeout(portSweeper, 500)
  })
}

portSweeper()

// demo vport...

/*
// test endpoint, lives at indice #2 
let ep2 = osap.endpoint("localTestEP")
// we can attach 'onData' handlers, which fire whenever something is tx'd to us: 
ep2.onData = (buffer) => {
  return new Promise((resolve, reject) => {
    try {
      // data isn't typed: these are a 'typedarray' (a native javascript type / class, which is memory-competent)
      console.log('the buffer', buffer)
    } catch (err) {
      console.error(err)
    }
    resolve()
  })
}

//ep2.addRoute(PK.route().sib(2).pfwd().sib(2).end())
*/
