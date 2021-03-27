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

import { TS, PK, DK, AK, EP } from '../osapjs/core/ts.js'
import LeastSquares from './util/lsq.js'

export default function LoadVM(osap, route) {
  // want a calibration 
  let lsq = new LeastSquares()

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

  let readingQuery = osap.query(route, TS.endpoint(0, 0), 512)
  this.getReading = () => {
    return new Promise((resolve, reject) => {
      readingQuery.pull().then((data) => {
        let reading = TS.read("int32", data, 0, true)
        reading = lsq.predict(reading)
        resolve(reading)
      }).catch((err) => { reject(err) })
    })
  }
}