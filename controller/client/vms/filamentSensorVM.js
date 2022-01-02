/*
filamentSensorVM.js

vm for filament sensor 

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2021

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { PK, TS } from '../../osapjs/core/ts.js'

export default function FilamentSensorVM(osap, route) {

  let hallQuery = osap.query(PK.route(route).sib(1).end())
  this.getHallReading = () => {
    return new Promise((resolve, reject) => {
      hallQuery.pull().then((data) => {
        let reading = TS.read('float32', data, 0, true)
        resolve (reading) 
      }).catch((err) => { reject(err) })
    })
  }
}