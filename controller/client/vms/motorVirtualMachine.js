/*
tempVirtualMachine.js

vm for stepper motors 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2021

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { PK, TS, VT, EP, TIMES } from '../../osapjs/core/ts.js'

/* osape-smoothieroll-drop-stepper 
0: serialport 
1: bus head
2: axis pick set 
*/

export default function MotorVM(osap, route) {
  console.warn('motor route', JSON.parse(JSON.stringify(route)))
  
  let axisPickEP = osap.endpoint()
  axisPickEP.addRoute(PK.route(route).sib(2).end())
  this.setAxisPick = (pick) => {
    let datagram = new Uint8Array(1)
    TS.write('uint8', pick, datagram, 0, true)
    return new Promise((resolve, reject) => {
      axisPickEP.write(datagram, "acked").then(() => {
        resolve()
      }).catch((err) => { reject(err) })  
    })
  }
  
  let axisInvertEP = osap.endpoint()
  axisInvertEP.addRoute(PK.route(route).sib(3).end())
  this.setAxisInversion = (invert) => {
    let datagram = new Uint8Array(1)
    TS.write('boolean', invert, datagram, 0, true)
    return new Promise((resolve, reject) => {
      axisInvertEP.write(datagram, "acked").then(() => {
        resolve()
      }).catch((err) => { reject(err) })  
    })
  }

  // steps per unit 
  let spuEP = osap.endpoint()
  spuEP.addRoute(PK.route(route).sib(4).end())
  this.setSPU = (spu) => {
    let datagram = new Uint8Array(4)
    TS.write('float32', spu, datagram, 0, true)
    return new Promise((resolve, reject) => {
      spuEP.write(datagram, "acked").then(() => {
        resolve()
      }).catch((err) => { reject(err) })  
    })
  }

  // current scaling 0-1 
  let cscaleEP = osap.endpoint()
  cscaleEP.addRoute(PK.route(route).sib(5).end())
  this.setCScale = (cscale) => {
    let datagram = new Uint8Array(4)
    TS.write('float32', cscale, datagram, 0, true)
    return new Promise((resolve, reject) => {
      cscaleEP.write(datagram, "acked").then(() => {
        resolve()
      }).catch((err) => { reject(err) })  
    })
  }
}