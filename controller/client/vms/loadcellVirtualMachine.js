/*
loadcellVirtualMachine.js

vm for loadcell modules 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2021

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { PK, TS, VT, EP, TIMES } from '../../osapjs/core/ts.js'
import LeastSquares from '../../osapjs/client/utes/lsq.js'

export default function LoadVM(osap, route) {
  // want a calibration 
  let lsq = new LeastSquares()
  this.offset = 0 

  this.setObservations = (xy, units) => {
    if(units == 'grams'){
      console.log(xy[1])
      for(let i = 0; i < xy[1].length; i ++){
        xy[1][i] = xy[1][i] * 0.00980665;
        console.log(xy[1][i])
      }
    }
    lsq.setObservations(xy)
  }

  let readingQuery = osap.query(PK.route(route).sib(2).end())
  this.getReading = (raw = false) => {
    return new Promise((resolve, reject) => {
      readingQuery.pull().then((data) => {
        let reading = TS.read("int32", data, 0, true)
        reading = lsq.predict(reading)
        if(raw){ 
          resolve(reading)
        } else {
          resolve(reading + this.offset)
        }
      }).catch((err) => { reject(err) })
    })
  }

  this.tare = () => {
    return new Promise((resolve, reject) => {
      this.getReading(true).then((rd) => {
        this.offset = - rd
        resolve()
      }).catch((err) => {
        reject(err)
      })
    })
  }
}