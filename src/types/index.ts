export type Category='Закуски'|'Супы'|'Основные блюда'|'Десерты'|'Напитки'|'Коктейли'|'Другое';
export type Ingredient={id:string;name:string;price:number;unit:string;stock_quantity?:number};
export type StockIngredient={id:string;name:string;unit:string;stock_quantity:number};
export type Dish={id:string;name:string;sale_price:number;cost_price:number;recipe:Record<string,number>;category:Category;image_url?:string|null};
export type CartItem={dish:Dish;quantity:number};
export type AppRole='worker'|'manager'|'creator';
export type Profile={id:string;login:string;full_name:string;role:AppRole};
