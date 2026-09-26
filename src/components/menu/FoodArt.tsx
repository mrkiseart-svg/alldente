import { dishImage } from '@/lib/dishImage';
import type { Category } from '@/types';
export default function FoodArt({name,category}:{name:string;category:Category}){return <img src={dishImage(name,category)} alt={`Иллюстрация: ${name}`} loading="lazy"/>}
