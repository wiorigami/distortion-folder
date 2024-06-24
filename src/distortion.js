import { M } from "./flatfolder/math.js";
import { X } from "./flatfolder/conversion.js";
import { SOLVER } from "./flatfolder/solver.js";
import { NOTE } from "./flatfolder/note.js";
import { SVG } from "./flatfolder/svg.js";

export const DIST = {    // STATE DISTORTER
    scale: 1,
    rotation: 0,
    strength: 0.1,
    eps: 1,
    affine: (x, T) => {
        const { A, b } = T
        const Ax = DIST.matprod(A, x)
        return M.add(Ax, b);
    },

    matprod: (A, x) => {
        return [M.dot(A[0], x), M.dot(A[1], x)]
    },

    FOLD_2_VD: (FOLD) => {
        const s = DIST.scale
        const t = DIST.rotation
        const co = Math.cos(t)
        const si = Math.sin(t)
        const T = { A: [[s * co, -si * s], [s * si, s * co]], b: [0, 0] }
        const { V, Vf } = FOLD
        return Vf.map((vf, i) => { return M.add(V[i], M.sub(DIST.affine(vf, T), vf)) });
    },
    infer_FO: (FOLD, FOLD_D, CELL_D) => {
        //Solving only with FULL Constraints
        const { BF, SE, CF, SC, FC } = CELL_D
        const BI_map = new Map();
        for (const [i, k] of BF.entries()) {
            BI_map.set(k, i);
        }
        const BA0 = BF.map(() => 0);
        for (const [i, [f1, f2, o]] of FOLD.FO.entries()) {
            const k = M.encode_order_pair([f1, f2]);
            const [f1_0, f2_0] = M.decode(k);
            const o_0 = f1_0 == f1 ? 1 : 2;
            const bi = BI_map.get(k)
            BA0[bi] = o_0;
        }
        const BT3 = X.FC_CF_BF_2_BT3(FC, CF, BF);

        NOTE.time("Computing edge-edge overlaps");
        const ExE = X.SE_2_ExE(SE);
        NOTE.count(ExE, "edge-edge adjacencies");
        NOTE.lap();
        NOTE.time("Computing edge-face overlaps");
        const ExF = X.SE_CF_SC_2_ExF(SE, CF, SC);
        NOTE.count(ExF, "edge-face adjacencies");
        NOTE.lap();
        const [BT0, BT1, BT2] = X.BF_EF_ExE_ExF_BT3_2_BT0_BT1_BT2(BF, FOLD_D.EF, ExE, ExF, BT3);
        NOTE.count(BT0, "taco-taco", 6);
        NOTE.count(BT1, "taco-tortilla", 3);
        NOTE.count(BT2, "tortilla-tortilla", 2);
        NOTE.count(BT3, "independent transitivity", 3);
        const c = [0, 1, 2, 3].map((i) => { return document.getElementById("T" + i).checked })
        const BT = BF.map((F, i) => [c[0] ? BT0[i] : [], c[1] ? BT1[i] : [], c[2] ? BT2[i] : [], c[3] ? BT3[i] : []]);
        // const BT = BF.map((F, i) => [[], [], [], BT3[i]]);

        const sol = SOLVER.solve(BF, BT, BA0, 1);
        if (sol.length == 3) { // solve found unsatisfiable constraint
            NOTE.log("Solver: No solutions found.")
            return
        } // solve completed
        const [GB, GA] = sol;
        const GI = GB.map(() => 0);// take the first solution

        //Inferring FO
        FOLD_D.FO = X.edges_Ff_2_FO(X.BF_GB_GA_GI_2_edges(BF, GB, GA, GI), FOLD.Ff)
        return
    },


    write: (FOLD) => {
        const { V, Vf, EV, EA, FV, FO } = FOLD;
        const path = document.getElementById("import").value.split("\\");
        const name = path[path.length - 1].split(".")[0];
        FOLD = {
            file_spec: 1.1,
            file_creator: "flat-distorter",
            file_title: `${name}_dist`,
            file_classes: ["singleModel"],
            vertices_coords: V,
            edges_vertices: EV,
            edges_assignment: EA,
            faces_vertices: FV,
        };
        const data = {};
        if (FO != undefined) {
            FOLD.faceOrders = FO;   // TODO: remove implied face orders?
        }
        data.fold = new Blob([JSON.stringify(FOLD, undefined, 2)], {
            type: "application/json"
        });
        data.svg = new Blob([document.getElementById("output").outerHTML], {
            type: "image/svg+xml"
        });
        data.log = new Blob([NOTE.lines.join("\n")], {
            type: "text/plain"
        });
        const ex = SVG.clear("export");
        for (const [type, ext] of [
            ["dist", "fold"],
            ["dist", "svg"],
            ["log", "txt"]
        ]) {
            const link = document.createElement("a");
            const button = document.createElement("input");
            ex.appendChild(link);
            link.appendChild(button);
            link.setAttribute("download", `${name}_${type}.${ext}`);
            link.setAttribute("href", window.URL.createObjectURL(data[type]));
            button.setAttribute("type", "button");
            button.setAttribute("value", type);
        }
    },
}