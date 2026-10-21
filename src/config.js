export const environment=['production','test'].includes(process.env.NODE_ENV)?process.env.NODE_ENV:'development';
export const debug=environment==='development'||process.env.GRIDLINE_DEBUG==='1';
export const offline=process.env.GRIDLINE_OFFLINE==='1';
export const version='0.6.0-rc.1';
