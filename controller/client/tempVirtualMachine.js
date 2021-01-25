/*
tempVirtualMachine.js

vm for heater modules 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2021

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { TS, PK, DK, AK, EP } from '../osapjs/core/ts.js'

export default function TempVM(osap, route){
    let tempSetEP = osap.endpoint()
    tempSetEP.addRoute(route, TS.endpoint(0, 0), 512)
    this.setExtruderTemp = (temp) => {
      return new Promise((resolve, reject) => {
        let datagram = new Uint8Array(4)
        TS.write('float32', temp, datagram, 0, true)
        tempSetEP.write(datagram).then(() => {
          resolve()
        }).catch((err) => { reject(err) })
      })
    }
  
    let tempQuery = osap.query(route, TS.endpoint(0, 1), 512)
    this.getExtruderTemp = () => {
      return new Promise((resolve, reject) => {
        tempQuery.pull().then((data) => {
          let temp = TS.read('float32', data, 0, true)
          resolve(temp)
        }).catch((err) => { reject(err) })
      })
    }
  
    let outputQuery = osap.query(route, TS.endpoint(0, 2), 512)
    this.getExtruderTempOutput = () => {
      return new Promise((resolve, reject) => {
        outputQuery.pull().then((data) => {
          let effort = TS.read('float32', data, 0, true)
          resolve(effort)
        }).catch((err) => { reject(err) })
      })
    }
  
    let tempPIDTermsEP = osap.endpoint()
    tempPIDTermsEP.addRoute(route, TS.endpoint(0, 3), 512)
    this.setPIDTerms = (vals) => {
      return new Promise((resolve, reject) => {
        let datagram = new Uint8Array(12)
        TS.write('float32', vals[0], datagram, 0, true)
        TS.write('float32', vals[1], datagram, 4, true)
        TS.write('float32', vals[2], datagram, 8, true)
        tempPIDTermsEP.write(datagram).then(() => {
          resolve()
        }).catch((err) => { reject(err) })
      })
    }
}