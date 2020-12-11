/*
vport.js

virtual port, for osap

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2020

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { PK, EP } from './ts.js'

let getTimeStamp = null 

if(typeof process === 'object'){
  const { PerformanceObserver, performance } = require('perf_hooks')
  getTimeStamp = () => {
    return performance.now()
  }
} else {
  getTimeStamp = () => {
    return performance.now()
  }
}

// VPorts get PHYs, which are implemented on bootup,
// let phy = {
//   send: <function(buffer)>, // vPort hits this to ship bytes away
//   cts: <function()> returns <boolean>, // ok to send? low level flag
//   receive: <function(buffer)> // the phy will call this, when bytes
// }

// normally zero

// vPorts, are hooks, need view into the system to which they
// are operating w/ of...
export default function VPort(sys) {
  // debug some
  let loopTime = 0

  this.isVPort = true
  this.name = 'unnamed vPort'
  this.description = 'undescribed vPort'
  this.states = []
  this.busDrops = []
  this.portTypeKey = PK.PORTF.KEY // we are p2p

  // want to refactor this while running new keepalive: 
  // do this.send() that passes to phy and also 
  // decriments the reciprx count: when that count goes to zero, 
  // manage a timer that shuts the port if it's overdue: that's a 
  // third time parameter and should be defined someplace wherever the other two are... 
  // also want to write up how the system works: in the morning 

  // the virtual port needs handles to its phy
  this.phy = {}
  this.phy.maxSegLength = 128 // how many bytes payload in a TU? 128 *should be* osap-wide minimum
  this.phy.send = (buffer) => { return false } // function(buffer) implemented at driver, return true when success
  this.phy.status = EP.PORTSTATUS.CLOSED // implemented at driver: willing to accept at least one frame

  // hooks to phy to open / shut drivers 
  this.phy.open = () => {
    //console.warn(`no open() code implemented at phy for ${this.name}`)
  }
  this.phy.close = () => {
    //console.warn(`no close() code implemented at phy for ${this.name}`)
  }
  
  // attempt to re-open / open on request 
  this.open = () => {
    // only try to make state change if are closed, 
    if(this.phy.status != EP.PORTSTATUS.CLOSED) return 
    //console.log(`${this.name} attempt open`)
    this.phy.open()
  }

  // on keepalive timeout, this is fired, 
  this.close = () => {
    if(this.phy.status != EP.PORTSTATUS.OPEN) return  
    //console.log(`${this.name} attempt close`)
    this.phy.close()
  }

  this.setPortOpen = () => {
    // important to re-assert this as open, if recipRx.. is 0 when the thing opens,
    // it'll never send a packet and keepalive will fail, so set to 1 on open 
    this.phy.status = EP.PORTSTATUS.OPEN 
    this.recipRxBufSpace = 1 
  }

  // we have an internal receive buffer,
  this.rxb_size = 64 // space we'll report
  this.rxbuffer = [] // receiving packets,
  this.lastRXBufferSpaceTransmitted = 0 // track last buffer space we sent in flowcontrol 
  this.lastTxTime = 0
  this.getRXBufferSpace = () => {
    return (this.rxb_size - this.rxbuffer.length)
  }
  this.getRXBufferSize = () => {
    return this.rxb_size
  }

  // reciprocal receive buffer size *in segments* (packet spaces left)
  this.recipRxBufSpace = 0
  this.decrimentRecipRxBufSpace = () => {
    this.recipRxBufSpace -= 1
    this.lastTxTime = sys.getTimeStamp()
    //console.log(`RECPRX ${this.name} ${this.recipRxBufSpace}`)
    if(this.recipRxBufSpace == 0) console.log(`ZERO ${this.name}`)
  }

  // whether *we* are clear to send,
  this.cts = () => {
    // is it so simple?
    if (this.recipRxBufSpace > 0 && this.phy.status == EP.PORTSTATUS.OPEN) {
      return true
    } else {
      return false
    }
  }

  // akward, but collecting our own-indice from system,
  // can re-write later to go faster / use cached info
  this.ownIndice = () => {
    // what's my # ?
    let indice = null
    for (let i = 0; i < sys.vPorts.length; i++) {
      if (sys.vPorts[i] === this) {
        indice = i
      }
    }
    if (indice == null) throw new Error('vPort nc from sys, wyd?')
    return indice
  }

  // entry point for packets, fire osap's scanning routine
  this.phy.receive = (buffer) => {
    // load it,
    this.rxbuffer.push({
      arrivalTime: sys.getTimeStamp(),
      data: buffer,
    })
    // request system to handle some frames, will run until clear
    sys.onVPortReceive(this)
  }

} // end vPort def
