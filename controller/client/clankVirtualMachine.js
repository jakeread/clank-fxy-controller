/*
clankVirtualMachine.js

vm for Clank-CZ

Jake Read at the Center for Bits and Atoms
(c) Massachusetts Institute of Technology 2021

This work may be reproduced, modified, distributed, performed, and
displayed for any purpose, but must acknowledge the open systems assembly protocol (OSAP) project.
Copyright is retained and must be preserved. The work is provided as is;
no warranty is provided, and users accept all liability.
*/

import { TS, PK, DK, AK, EP } from '../osapjs/core/ts.js'

export default function ClankVM(osap, route) {

  // ok: we make an 'endpoint' that will transmit moves,
  let moveEP = osap.endpoint()
  // add the machine head's route to it, 
  moveEP.addRoute(`route`)

  // move like: { position: {X: num, Y: num, Z: num}, rate: num }
  this.addMoveToQueue = (move) => {
    // write the gram, 
    let wptr = 0
    let datagram = new Uint8Array(16)
    // write posns 
    wptr += TS.write('float32', move.position.X, datagram, wptr, true)
    wptr += TS.write('float32', move.position.Y, datagram, wptr, true)
    wptr += TS.write('float32', move.position.Z, datagram, wptr, true)
    // write rate 
    wptr += TS.write('float32', move.rate, datagram, wptr, true)
    // do the networking, 
    return new Promise((resolve, reject) => {
      let check = () => {
        if (moveEP.cts()) {
          moveEP.write(datagram).then(() => {
            resolve()
          }).catch((err) => {
            reject(err)
          })
        } else {
          setTimeout(check, 10)
        }
      }
      check()
    })
  }
  
}