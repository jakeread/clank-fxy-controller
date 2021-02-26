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

export default function LoadVM(osap, route) {
  // want a calibration 
  let readingQuery = osap.query(route, TS.endpoint(0, 0), 512)
  this.getReading = () => {
    return new Promise((resolve, reject) => {
      readingQuery.pull().then((data) => {
        let reading = TS.read("int32", data, 0, true)
        resolve(reading)
      }).catch((err) => { reject(err) })
    })
  }
}