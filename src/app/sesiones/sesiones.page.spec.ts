import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SesionesPage } from './sesiones.page';

describe('SesionesPage', () => {
  let component: SesionesPage;
  let fixture: ComponentFixture<SesionesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SesionesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
