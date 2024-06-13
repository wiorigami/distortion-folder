import { M } from "./flatfolder/math.js";

export const DIST = {    // STATE DISTORTER

    affine: (x, T) => {
        const { A, b } = T
        const Ax = DIST.matprod(A, x)
        return M.add(Ax, b);
    },

    matprod: (A, x) => {
        return [M.dot(A[0], x), M.dot(A[1], x)]
    },
}