let vDist = (v1, v2) => {
    // takes v1, v2 to be arrays of same length
    // computes cartesian distance
    var sum = 0
    for (let i = 0; i < v1.length; i++) {
        sum += (v1[i] - v2[i]) * (v1[i] - v2[i])
    }
    return Math.sqrt(sum)
}

let vSum = (v1, v2) => {
  let ret = []
  for(let i = 0; i < v1.length; i ++){
    ret.push(v1[i] + v2[i])
  }
  return ret
}

let vLen = (v) => {
  let sum = 0
  for(let i = 0; i < v.length; i ++){
    sum += Math.pow(v[i], 2)
  }
  return Math.sqrt(sum)
}

// from v1 to v2,
let vUnitBetween = (v1, v2) => {
  let dist = vDist(v1, v2)
  let ret = []
  for(let i = 0; i < v1.length; i ++){
    ret[i] = (v2[i] - v1[i]) / dist
  }
  return ret
}

let vScalar = (v, s) => {
  let ret = []
  for(let i = 0; i < v.length; i ++){
    ret[i] = v[i] * s
  }
  return ret
}

let deg = (rad) => {
  return rad * (180 / Math.PI)
}

export { vDist, vSum, vLen, vUnitBetween, vScalar, deg }
