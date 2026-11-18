import{applyTunnelTerrain}from'./tunnel-terrain.mjs';
import{applyDirectedAC}from'./directed-ac.mjs';
import{applyWahMeiWest}from'./wah-mei-west.mjs';
// Serialize this composition before adding runtime cameras or regional metadata.
export function applyApprovedTerrain(rawCatalogue){return applyTunnelTerrain(applyWahMeiWest(applyDirectedAC(rawCatalogue)));}
