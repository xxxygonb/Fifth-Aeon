import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoggedInGuard } from 'app/login.guard';
import { AdminPanelComponent } from './admin-panel/admin-panel.component';

const routes: Routes = [
    {
        // 懒加载入口由 AppRoutingModule 提供 'admin' 前缀，这里用相对路径
        path: '',
        component: AdminPanelComponent,
        canActivate: [LoggedInGuard]
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class AdminRoutingModule {}
