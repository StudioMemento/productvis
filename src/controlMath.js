export function snapValue(value, min, max, step) {
  if (!Number.isFinite(value)) return min;
  const bounded = Math.min(max, Math.max(min, value));
  if (bounded === max || bounded === min) return bounded;
  return Math.min(max, Math.max(min, Number((min + Math.round((bounded - min) / step) * step).toFixed(6))));
}

export function dragValue(start, delta, min, max, step, fine = false) {
  return snapValue(start + delta * (max - min) / (fine ? 1200 : 180), min, max, step);
}

// Input units are a control contract, independent of renderer storage units.
export function valueAdapter({min=0,max=1,step=.01,scale=100,unit='%',precision}={}) {
  const decimals=precision??Math.max(0,Math.min(6,Math.ceil(-Math.log10(step*scale))));
  const display=value=>Number((value*scale).toFixed(decimals));
  return {min:display(min),max:display(max),step:display(step),unit,
    draft:value=>String(display(value)),
    parse(text){
      const raw=text.trim().replace(',','.');
      if(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw))return {error:'Inserisci un numero valido'};
      const value=Number(raw),low=min*scale,high=max*scale;
      if(!Number.isFinite(value))return {error:'Inserisci un numero valido'};
      if(value<low-1e-8||value>high+1e-8)return {error:`Da ${display(min)} a ${display(max)}${unit?' '+unit:''}`};
      return {value:snapValue(value/scale,min,max,step)};
    }
  };
}
