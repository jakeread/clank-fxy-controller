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

  // homing 
  let homeEP = osap.endpoint()
  homeEP.addRoute(PK.route(route).sib(6).end())
  this.home = (rate, offset) => {
    if(!rate || !offset){
      rate = 20
      offset = 10
    }
    //console.log(rate / 60, offset)
    let datagram = new Uint8Array(8)
    TS.write('float32', rate / 60, datagram, 0, true)
    TS.write('float32', offset, datagram, 4, true)
    return new Promise((resolve, reject) => {
      homeEP.write(datagram, "acked").then(() => {
        resolve()
      }).catch((err) => { reject(err) })
    })
  }

  // home state 
  let homeStateQuery = osap.query(PK.route(route).sib(7).end())
  this.getHomeState = () => {
    return new Promise((resolve, reject) => {
      homeStateQuery.pull().then((data) => {
        if(data[0] > 0){
          resolve(true)
        } else {
          resolve(false)
        }
      }).catch((err) => { reject(err) })
    })
  }

  this.awaitHomeComplete = () => {
    return new Promise((resolve, reject) => {
      let check = () => {
        this.getHomeState().then((homing) => {
          if(homing){
            setTimeout(check, 50)
          } else {
            resolve()
          }
        }).catch((err) => { reject(err) })
      } // end 'check' def 
      setTimeout(check, 50)
    })
  }
}