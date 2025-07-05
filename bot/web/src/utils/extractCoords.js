// Извлекает координаты из ссылки Google Maps
export default function extractCoords(url){
  try{
    let m=url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if(!m){
      m=url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    }
    if(m){
      return {lat:parseFloat(m[1]),lng:parseFloat(m[2])};
    }
    return null;
  }catch{
    return null;
  }
}
