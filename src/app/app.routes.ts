import { Routes } from '@angular/router';
import { SellerComponent } from './components/seller/seller.component';
import { BuyerComponent } from './components/buyer/buyer.component';

export const routes: Routes = [
  { path: '', redirectTo: 'vendedor', pathMatch: 'full' },
  { path: 'vendedor', component: SellerComponent, title: 'Balança e Pesagem | Colombo Agro' },
  { path: 'comprador', component: BuyerComponent, title: 'Painel do Comprador | Colombo Agro' },
  { path: '**', redirectTo: 'vendedor' }
];
