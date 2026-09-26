import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminPanelComponent } from './admin-panel/admin-panel.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from 'app/material.module';
import { AdminRoutingModule } from './admin-routing.module';

// 懒加载模块：管理面板。
@NgModule({
    declarations: [AdminPanelComponent],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        AdminRoutingModule
    ]
})
export class AdminModule {}
