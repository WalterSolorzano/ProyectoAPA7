import { render, screen, fireEvent } from '@testing-library/react';
import { TablaEstiloSelector } from '../components/figures/TablaEstiloSelector';

it('arranca colapsado y muestra solo el icono', () => {
  render(<TablaEstiloSelector onChange={() => {}} />);
  expect(screen.getByRole('button', { name: /estilo de tabla/i })).toBeTruthy();
  expect(screen.queryByText('Cuadrícula')).toBeNull();
});

it('al abrir lista los presets y avisa los no-APA', () => {
  render(<TablaEstiloSelector onChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /estilo de tabla/i }));
  expect(screen.getByText('Cuadrícula')).toBeTruthy();
  expect(screen.getByText('Cebra')).toBeTruthy();
  expect(screen.getAllByText(/no APA/i).length).toBeGreaterThan(0);
});

it('elegir un preset llama onChange con su id', () => {
  const onChange = vi.fn();
  render(<TablaEstiloSelector onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /estilo de tabla/i }));
  fireEvent.click(screen.getByText('Compacto'));
  expect(onChange).toHaveBeenCalledWith('compact');
});
