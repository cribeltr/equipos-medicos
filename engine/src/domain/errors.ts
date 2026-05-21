/**
 * Error de dominio: representa una violación de regla de negocio o de
 * validación de entrada. Los mensajes son cortos y en español casual,
 * como en la app original (spec §12).
 */
export class DomainError extends Error {
  override readonly name = 'DomainError';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

/** Lanza un `DomainError` si la condición es falsa. */
export function assertDominio(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new DomainError(mensaje);
}
