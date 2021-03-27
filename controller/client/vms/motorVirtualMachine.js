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

import { TS } from '../../osapjs/core/ts.js'

export default function MotorVM(osap, route) {
  
  // 1st (0th) axis pick
  let axisPickEP = osap.endpoint()
  axisPickEP.addRoute(route, TS.endpoint(0, 0), 512)
  this.setAxisPick = (pick) => {
    let datagram = new Uint8Array(1)
    TS.write('uint8', pick, datagram, 0, true)
    return new Promise((resolve, reject) => {
      axisPickEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => { reject(err) })  
    })
  }
  
  // axis invert, 
  let axisInvertEP = osap.endpoint()
  axisInvertEP.addRoute(route, TS.endpoint(0, 1), 512)
  this.setAxisInversion = (invert) => {
    let datagram = new Uint8Array(1)
    TS.write('boolean', invert, datagram, 0, true)
    return new Promise((resolve, reject) => {
      axisInvertEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => { reject(err) })  
    })
  }

  // steps per unit 
  let spuEP = osap.endpoint()
  spuEP.addRoute(route, TS.endpoint(0, 2), 512)
  this.setSPU = (spu) => {
    let datagram = new Uint8Array(4)
    TS.write('float32', spu, datagram, 0, true)
    return new Promise((resolve, reject) => {
      spuEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => { reject(err) })  
    })
  }

  // current scaling 0-1 
  let cscaleEP = osap.endpoint()
  cscaleEP.addRoute(route, TS.endpoint(0, 3), 512)
  this.setCScale = (cscale) => {
    let datagram = new Uint8Array(4)
    TS.write('float32', cscale, datagram, 0, true)
    return new Promise((resolve, reject) => {
      cscaleEP.write(datagram).then(() => {
        resolve()
      }).catch((err) => { reject(err) })  
    })
  }
}