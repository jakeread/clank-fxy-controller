/*

lsq.js 

input previous system measurements as state (lists)
make predictions for y based on input at x, with lsq. from old data

*/

import smallmath from './smallmath.js'

export default function LeastSquares() {
  // internal state 
  // unit observation to start 
  let observations = []
  let m = 1 
  let b = 0

  // setup 
  this.setObservations = (xy) => {
    observations = JSON.parse(JSON.stringify(xy))
    if(observations[0].length > 2){
      let lsqr = smallmath.lsq(observations[0], observations[1])
      m = lsqr.m 
      b = lsqr.b 
      console.log(m, b)
    }
  }

  // to generate human-readable interp of model 
  this.printFunction = () => {
    if (b >= 0) {
      return `${m.toExponential(2)} x + ${b.toExponential(2)}`
    } else {
      return `${m.toExponential(2)} x ${b.toExponential(2)}`
    }
  }

  this.predict = (x) => {
    return m * x + b 
  }

  // start with 
  this.setObservations([[1,2,3], [1,2,3]])
}
