// Copy decoded interleaved local positions; do not transfer the render buffer.
// World-coordinate addition is Float64 to avoid extra Float32 requantization.
export function copyCollisionPositions(parts){let count=0;for(const p of parts){if(!p.data||p.data.length%6)throw Error('Decoded position/normal input required');count+=p.data.length/6;}const out=new Float64Array(count*3);let j=0;for(const p of parts)for(let i=0;i<p.data.length;i+=6)for(let k=0;k<3;k++)out[j++]=p.data[i+k]+p.origin[k];return out;}
