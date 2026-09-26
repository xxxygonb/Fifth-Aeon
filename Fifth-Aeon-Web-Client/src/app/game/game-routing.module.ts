import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GameComponent } from './game.component';
import { InPlayGuard } from 'app/in-play.guard';

const routes: Routes = [
    {
        path: '',
        component: GameComponent,
        canActivate: [InPlayGuard]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class GameRoutingModule {}
