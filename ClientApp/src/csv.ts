export type CsvCell=string|number|boolean|null|undefined;

/** Turkish Excel opens ';'-separated UTF-8 files with a BOM and decimal commas correctly. */
export function toCsv(header:string[],rows:CsvCell[][]):string{
  const cell=(value:CsvCell)=>{
    if(value===null||value===undefined) return '';
    const text=typeof value==='number'?value.toLocaleString('tr-TR',{useGrouping:false,maximumFractionDigits:3}):String(value);
    // Neutralise spreadsheet formulas in user text (=, +, -, @) and quote when needed.
    const safe=typeof value==='string'&&/^[=+\-@\t\r]/.test(text)?`'${text}`:text;
    return /[";\n\r]/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;
  };
  return '﻿'+[header,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}

export function downloadCsv(fileName:string,header:string[],rows:CsvCell[][]){
  const url=URL.createObjectURL(new Blob([toCsv(header,rows)],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=fileName.endsWith('.csv')?fileName:`${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
