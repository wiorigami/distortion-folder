import { M } from "./flatfolder/math.js";
import { NOTE } from "./flatfolder/note.js";
import { SVG } from "./flatfolder/svg.js";
import { IO } from "./flatfolder/io.js";
import { X } from "./flatfolder/conversion.js";
import { CON } from "./flatfolder/constraints.js";
import { SOLVER } from "./flatfolder/solver.js";
import { DIST } from "./distortion.js";
import { SMPL } from "./sample_fold.js";

window.onload = () => { MAIN.startup(); };  // entry point

const MAIN = {

    color: {
        background: "lightgray",
        face: {
            top: "#3C4BAA",
            bottom: "#FFF",
        },
        edge: {
            U: "black",
            F: "lightgray",
            B: "black",
        },
        rand: [
            "lightpink", "lightgreen", "lightskyblue", "gold",
            "lightsalmon", "powderblue", "lavender", "sandybrown"
        ],
    },

    startup: () => {
        CON.build();
        NOTE.clear_log();
        NOTE.start("*** Starting Flat-Folder ***");
        NOTE.time("Initializing interface");
        const [b, s] = [50, SVG.SCALE];
        const main = document.getElementById("main");
        for (const [k, v] of Object.entries({
            xmlns: SVG.NS,
            style: "background: lightgray",
            viewBox: [0, 0, 3 * s, s].join(" "),
        })) {
            main.setAttribute(k, v);
        }
        document.getElementById("shadow").value = 0;
        for (const [i, id] of ["input", "cp", "output"].entries()) {
            const svg = document.getElementById(id);
            for (const [k, v] of Object.entries({
                xmlns: SVG.NS,
                height: s,
                width: s,
                x: i * s,
                y: 0,
                viewBox: [-b, -b, s + 2 * b, s + 2 * b].join(" "),
            })) {
                svg.setAttribute(k, v);
            }
        }
        document.getElementById("import").onchange = (e) => {
            if (e.target.files.length > 0) {
                const file_reader = new FileReader();
                file_reader.onload = MAIN.process_file;
                file_reader.readAsText(e.target.files[0]);
            }
        };
        const e = { target: { result: SMPL.water_bomb } }
        MAIN.process_file(e)
    },
    process_file: (e) => {
        NOTE.clear_log();
        NOTE.start("*** Starting File Import ***");
        const doc = e.target.result;
        const file_name = document.getElementById("import").value;
        const parts = file_name.split(".");
        const type = parts[parts.length - 1].toLowerCase();
        if (type != "fold" && type != "cp" && file_name != "") {
            NOTE.log(`Found file with extension ${type}, FOLD/CP format required`);
            return;
        }
        NOTE.time(`Importing from file ${file_name}`);
        var FILE = (type == "cp") ? MAIN.CP_2_FILE(doc, type) : JSON.parse(doc);

        if ((FILE.file_frames == undefined) || (FILE.file_frames.length < 2)) {
            console.log("File does not have at least 2 FOLD frames to sequence");
            FILE.file_frames = [FILE, FILE]
        }
        FILE.i = 0;
        MAIN.draw_frame(FILE);
        document.getElementById("next").onclick = () => {
            FILE.i = Math.min(FILE.i + 1, FILE.file_frames.length - 2);
            MAIN.draw_frame(FILE);
        };
        document.getElementById("prev").onclick = () => {
            FILE.i = Math.max(FILE.i - 1, 0);
            MAIN.draw_frame(FILE);
        };
        document.getElementById("flip").onchange = () => {
            MAIN.draw_frame(FILE);
        };
        document.getElementById("shadow").onchange = () => {
            MAIN.draw_frame(FILE);
        };
        document.getElementById("topcolor").oninput = () => {
            MAIN.color.face.top = document.getElementById("topcolor").value
            MAIN.draw_frame(FILE);
        };
        document.getElementById("bottomcolor").oninput = () => {
            MAIN.color.face.bottom = document.getElementById("bottomcolor").value
            MAIN.draw_frame(FILE);
        };
        document.getElementById("stren").oninput = () => {
            const value = document.getElementById("stren").value
            DIST.strength = Math.pow(2, -1 / value)
            DIST.scale = 1 + (document.getElementById("scale").value - 0.5) * DIST.strength
            DIST.rotation = (document.getElementById("rotat").value - 0.5) * DIST.strength * Math.PI
            MAIN.draw_frame(FILE);
        };
        document.getElementById("scale").oninput = () => {
            const value = document.getElementById("scale").value
            DIST.scale = 1 + (value - 0.5) * DIST.strength
            MAIN.draw_frame(FILE);
        };
        document.getElementById("rotat").oninput = () => {
            const value = document.getElementById("rotat").value
            DIST.rotation = (value - 0.5) * DIST.strength * Math.PI
            MAIN.draw_frame(FILE);
        };
        document.getElementById("reset-stren").onclick = () => {
            document.getElementById("stren").value = 0.5
            DIST.strength = 0.1
            MAIN.draw_frame(FILE);
        }
        document.getElementById("reset-scale").onclick = () => {
            document.getElementById("scale").value = 0.5
            DIST.scale = 1
            MAIN.draw_frame(FILE);
        }
        document.getElementById("reset-rotat").onclick = () => {
            document.getElementById("rotat").value = 0.5
            DIST.rotation = 0
            MAIN.draw_frame(FILE);
        }
        for (const i in [0, 1, 2, 3]) {
            document.getElementById("T" + i).onchange = () => {
                MAIN.draw_frame(FILE);
            }
        }
        document.getElementById("eps").oninput = () => {
            const value = document.getElementById("eps").value
            DIST.eps = Math.pow(2, -1 / (value) + 1)
            MAIN.draw_frame(FILE);
        };
        document.getElementById("reset-eps").onclick = () => {
            document.getElementById("eps").value = 0.5
            DIST.eps = 1
            MAIN.draw_frame(FILE);
        }
        // console.log(FILE);
    },
    get_frame: (FILE, i) => {
        const frame = FILE.file_frames[i];
        const [FOLD, CELL] = MAIN.V_FV_2_FOLD_CELL(
            frame.vertices_coords,
            frame.faces_vertices
        );
        FOLD.FL = frame["faces_lf:group"];
        FOLD.FO = frame.faceOrders;
        FOLD.line = frame["lf:line"];
        FOLD.points = frame["lf:points"];
        MAIN.putCD(FOLD, CELL);
        FOLD.Vf = X.V_FV_EV_EA_2_Vf_Ff(FOLD.V, FOLD.FV, FOLD.EV, FOLD.EA)[0];
        if (M.polygon_area2(M.expand(FOLD.FV[0], FOLD.Vf)) < 0) {
            FOLD.Vf = FOLD.Vf.map(v => M.add(M.refY(v), [0, 1]));
        }
        const v0 = FOLD.Vf[0];
        FOLD.Vf = FOLD.Vf.map(p => M.sub(p, v0));
        const [c1, s1] = FOLD.Vf[1];
        FOLD.Vf = FOLD.Vf.map(p => M.rotate_cos_sin(p, c1, -s1));
        FOLD.Vf = FOLD.Vf.map(p => M.rotate_cos_sin(p, 0, 1));
        FOLD.Vf = M.normalize_points(FOLD.Vf);
        return [FOLD, CELL];
    },
    draw_frame: (FILE) => {
        const [F1, C1] = MAIN.get_frame(FILE, FILE.i);
        if (FILE.i < FILE.file_frames.length - 1) {
            const out = SVG.clear("output");
            const [F2, C2] = MAIN.get_frame(FILE, FILE.i + 1);
            MAIN.draw_cp(SVG.clear("cp"), F2);
            const VD = DIST.FOLD_2_VD(F2)
            const [FOLD_D, CELL_D] = MAIN.V_FV_2_FOLD_CELL(VD, F2.FV)
            DIST.infer_FO(F2, FOLD_D, CELL_D)
            document.getElementById("export").onclick = () => DIST.write(FOLD_D)
            MAIN.putCD(FOLD_D, CELL_D);
            MAIN.draw_state(out, FOLD_D, CELL_D);
            MAIN.draw_state(SVG.clear("input"), F1, C1, F2);
        } else {
            MAIN.draw_state(SVG.clear("input"), F1, C1);
            MAIN.draw_cp(SVG.clear("cp"), F1, false);
        }
    },
    EF_Ff_edges_2_EA: (EF, Ff, edges) => {
        const edge_map = new Set(edges);
        return EF.map(F => {
            if (F.length != 2) { return "B"; }
            const [i, j] = F;
            if (edge_map.has(M.encode([i, j]))) { return Ff[i] ? "M" : "V"; }
            if (edge_map.has(M.encode([j, i]))) { return Ff[i] ? "V" : "M"; }
            return "F";
        });
    },
    draw_cp: (svg, F, bold = true) => {
        // console.log(F);
        const { V, Vf, FV, EV, EF, EA, Ff, FO, FL } = F;
        const faces = FV.map(F => M.expand(F, Vf));
        const lines = EV.map(E => M.expand(E, Vf));
        const colors = EA.map(a => {
            if (a == "B") { return "black"; }
            if (a == "M") { return "blue"; }
            if (a == "V") { return "red"; }
            if (a == "F") { return "gray"; }
        });
        const g1 = SVG.append("g", svg, { id: "flat_f" });
        const g2 = SVG.append("g", svg, { id: "flat_e" });
        const g3 = SVG.append("g", svg, { id: "flat_p" });
        if ((FL == undefined) || !bold) {
            SVG.draw_segments(g2, lines, { stroke: colors, id: true });
            SVG.draw_polygons(g1, faces, { fill: "white", id: true });
        } else {
            const Fc = FL.map(i => (i < 0) ? "white" : (
                MAIN.color.rand[i % MAIN.color.rand.length]));
            SVG.draw_polygons(g1, faces, { fill: Fc, id: true });
            SVG.draw_segments(g2, lines, {
                stroke: colors, id: true, stroke_width: 1,
                filter: (i) => {
                    const [f, g] = EF[i];
                    return (g == undefined) || (FL[f] == FL[g]);
                },
            });
            SVG.draw_segments(g2, lines, {
                stroke: colors, id: true, stroke_width: 5,
                filter: (i) => {
                    const [f, g] = EF[i];
                    return (g != undefined) && (FL[f] != FL[g]);
                },
            });
        }
        // SVG.draw_points(g3, Vf, {text: true, fill: "green"});
    },
    draw_state: (svg, FOLD, CELL, F2) => {
        const { Ff, EF, FO } = FOLD;
        const { P, CP, CD, SP, SC, SE } = CELL;
        const flip = document.getElementById("flip").checked;
        const m = [0.5, 0.5];
        const Q = M.normalize_points(
            P.map(p => (flip ? M.add(M.refX(M.sub(p, m)), m) : p))
        );
        const Ctop = CD.map(S => flip ? S[0] : S[S.length - 1]);
        const SD = X.Ctop_SC_SE_EF_Ff_2_SD(Ctop, SC, SE, EF, Ff);
        const [RP, Rf] = X.Ctop_CP_SC_SD_Ff_P_2_RP_Rf(Ctop, CP, SC, SD, Ff, Q);
        const Rcolor = Rf.map(f => {
            if (f == undefined) { return undefined; }
            return MAIN.color.face[(f != flip) ? "top" : "bottom"];
        });
        const regions = RP.map(V => M.expand(V, Q));
        const G = {};
        for (const id of ["c", "shadow", "s_crease", "s_edge"]) {
            G[id] = SVG.append("g", svg, { id: `${svg.id}_${id}` });
        }
        SVG.draw_polygons(G.c, regions, {
            id: true, fill: Rcolor, stroke: "none"
        });
        const n = +document.getElementById("shadow").value;
        if (n > 0) { SVG.draw_shadows(G.shadow, RP, Rf, Q, SP, SD, flip, n); }
        const lines = SP.map((ps) => M.expand(ps, Q));
        SVG.draw_segments(G.s_crease, lines, {
            id: true, stroke: MAIN.color.edge.F,
            filter: (i) => SD[i][0] == "C"
        });
        SVG.draw_segments(G.s_edge, lines, {
            id: true, stroke: MAIN.color.edge.B,
            filter: (i) => SD[i][0] == "B"
        });
        if ((F2 != undefined) && (F2.points != undefined)) {
            const line = [MAIN.line_2_coords(F2.line).map(
                p => flip ? M.add(M.refX(M.sub(p, m)), m) : p
            )];
            SVG.draw_segments(G.s_edge, line, {
                id: true, stroke: "purple", stroke_width: 5,
            });
            SVG.draw_points(G.s_edge, M.expand(F2.points, Q), {
                fill: "green", r: 10,
            });
        }
    },
    line_2_coords: (line) => {
        const [u, d] = line;
        const p = M.mul(u, d);
        const off = M.mul(M.perp(u), 10);
        const p1 = M.add(p, off);
        const p2 = M.sub(p, off);
        return [p1, p2];
    },
    V_FV_2_FOLD_CELL: (V, FV) => {
        const Ff = MAIN.FV_V_2_Ff(FV, V);
        const EV_set = new Set();
        for (const fV of FV) {
            let i = fV.length - 1;
            for (let j = 0; j < fV.length; ++j) {
                EV_set.add(M.encode_order_pair([fV[i], fV[j]]));
                i = j;
            }
        }
        const EV = Array.from(EV_set).sort().map(k => M.decode(k));
        const [EF, FE] = X.EV_FV_2_EF_FE(EV, FV);
        const L = EV.map(vs => vs.map(i => V[i]));
        NOTE.time("Constructing points and segments from edges");
        const [P, SP, SE, eps_i] = X.L_2_V_EV_EL(L);
        const eps = M.min_line_length(L) / (2 ** eps_i) * DIST.eps;
        NOTE.time(`Used eps: ${2 ** eps_i} | ${eps}`);
        NOTE.annotate(P, "points_coords");
        NOTE.annotate(SP, "segments_points");
        NOTE.annotate(SE, "segments_edges");
        NOTE.lap();
        NOTE.time("Constructing cells from segments");
        const [PP, CP] = X.V_EV_2_VV_FV(P, SP);
        NOTE.annotate(CP, "cells_points");
        NOTE.lap();
        NOTE.time("Computing segments_cells");
        const [SC, CS] = X.EV_FV_2_EF_FE(SP, CP);
        NOTE.annotate(SC, "segments_cells");
        NOTE.annotate(CS, "cells_segments");
        NOTE.lap();
        NOTE.time("Making face-cell maps");
        const [CF, FC] = X.EF_FV_SP_SE_CP_SC_2_CF_FC(EF, FV, SP, SE, CP, SC);
        const BF = X.CF_2_BF(CF);
        NOTE.annotate(BF, "variables_faces");
        NOTE.lap();
        const FOLD = { V, FV, EV, EF, FE, Ff, eps };
        const CELL = { P, SP, SE, PP, CP, CS, SC, CF, FC, BF };
        return [FOLD, CELL];
    },
    linearize: (edges, n) => {
        const Adj = Array(n).fill(0).map(() => []);
        for (const s of edges) {
            const [f1, f2] = M.decode(s);
            Adj[f1].push(f2);
        }
        const L = [];
        const seen = Array(n).fill(false);
        const dfs = (i) => {
            if (seen[i]) { return; }
            seen[i] = true;
            for (const j of Adj[i]) {
                dfs(j);
            }
            L.push(i);
        };
        for (let i = 0; i < n; ++i) {
            dfs(i);
        }
        L.reverse();
        console.assert(L.length == n);
        const idx_map = Array(n).fill(undefined);
        for (let i = 0; i < n; ++i) {
            const fi = L[i];
            idx_map[fi] = i;
        }
        for (const s of edges) {
            const [f1, f2] = M.decode(s);
            if (idx_map[f1] > idx_map[f2]) {
                return undefined; // cycle
            }
        }
        for (let i = 0; i < n; ++i) {
            seen[i] = false;
        }
        const layers = [];
        for (let i = 0; i < n; ++i) {
            const fi = L[i];
            if (seen[fi]) { continue; }
            seen[fi] = true;
            const layer = [fi];
            const Adj_set = new Set();
            for (const fj of Adj[fi]) {
                Adj_set.add(fj);
            }
            for (let j = i + 1; j < L.length; ++j) {
                const fj = L[j];
                if (seen[fj]) { continue; }
                if (!Adj_set.has(fj)) {
                    seen[fj] = true;
                    layer.push(fj);
                }
                for (const fk of Adj[fj]) {
                    Adj_set.add(fk);
                }
            }
            layers.push(layer);
        }
        return layers;
    },
    FV_V_2_Ff: (FV, V) => FV.map(fV => (M.polygon_area2(fV.map(i => V[i])) < 0)),
    putCD: (FOLD, CELL) => {
        const edges = FOLD.FO.map(([f1, f2, o]) => {
            return M.encode(((FOLD.Ff[f2] ? 1 : -1) * o >= 0) ? [f1, f2] : [f2, f1]);
        });
        CELL.CD = X.CF_edges_2_CD(CELL.CF, edges);
        FOLD.EA = MAIN.EF_Ff_edges_2_EA(FOLD.EF, FOLD.Ff, edges);
    },

    CP_2_FILE: (doc, type) => {
        const [V, VV, EV, EA, EF, FV, FE] =
            IO.doc_type_2_V_VV_EV_EA_EF_FV_FE(doc, type);
        if (V == undefined) { return; }
        const VK = X.V_VV_EV_EA_2_VK(V, VV, EV, EA);
        const [Vf, Ff] = X.V_FV_EV_EA_2_Vf_Ff(V, FV, EV, EA);
        const Vf_norm = M.normalize_points(Vf);
        const FOLD = { V, Vf, Vf_norm, VK, EV, EA, EF, FV, FE, Ff };

        const L = EV.map((P) => M.expand(P, Vf));
        const [P, SP, SE, eps_i] = X.L_2_V_EV_EL(L);
        FOLD.eps = M.min_line_length(L) / (2 ** eps_i);
        const [, CP] = X.V_EV_2_VV_FV(P, SP);
        const [SC, CS] = X.EV_FV_2_EF_FE(SP, CP);
        const [CF, FC] = X.EF_FV_SP_SE_CP_SC_2_CF_FC(EF, FV, SP, SE, CP, SC);
        const ExE = X.SE_2_ExE(SE);
        const ExF = X.SE_CF_SC_2_ExF(SE, CF, SC);
        const BF = X.CF_2_BF(CF);
        const BT3 = X.FC_CF_BF_2_BT3(FC, CF, BF);
        const [BT0, BT1, BT2] = X.BF_EF_ExE_ExF_BT3_2_BT0_BT1_BT2(BF, EF, ExE, ExF, BT3);
        const BT = BF.map((F, i) => [BT0[i], BT1[i], BT2[i], BT3[i]]);
        const BA0 = X.EF_EA_Ff_BF_2_BA0(EF, EA, Ff, BF);
        const sol = SOLVER.solve(BF, BT, BA0, 1);
        if (sol.length == 3) { // solve found unsatisfiable constraint
            NOTE.log("no valid state found");
            return;
        } // solve completed
        const [GB, GA] = sol;
        const n = (GA == undefined) ? 0 : GA.reduce((s, A) => {
            return s * BigInt(A.length);
        }, BigInt(1));
        NOTE.count(n, "folded states");
        if (n > 0) {
            const GI = GB.map(() => 0);
            NOTE.time("Computing state");
            const edges = X.BF_GB_GA_GI_2_edges(BF, GB, GA, GI);
            FOLD.FO = X.edges_Ff_2_FO(edges, Ff);
        }
        const path = document.getElementById("import").value.split("\\");
        const name = path[path.length - 1].split(".")[0];
        return {
            file_spec: 1.1,
            file_creator: "flat-folder",
            file_title: `${name}_state`,
            file_classes: ["singleModel"],
            vertices_coords: Vf,
            edges_vertices: EV,
            edges_assignment: EA,
            faces_vertices: FV,
            faceOrders: FOLD.FO,
        };
    },
};
