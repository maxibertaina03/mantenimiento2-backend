import { Injectable } from '@nestjs/common';
import { Usuario } from '@prisma/client';

/**
 * Cache en memoria del usuario resuelto por token, con TTL corto.
 *
 * Sin esto, CADA request hacía un roundtrip de red a la API de Clerk
 * (`clerk.users.getUser`) más 1-3 queries a la base solo para resolver quién es
 * el usuario. Eso agrega latencia a todos los endpoints y consume el rate limit
 * de Clerk en proporción al tráfico.
 *
 * El TTL es corto a propósito: un cambio de nombre/rol se refleja en <= 60s.
 * Es por proceso (no distribuido); con varias instancias cada una tiene la suya,
 * lo cual es correcto porque el contenido es idéntico y derivable.
 */
const TTL_MS = 60_000;
const MAX_ENTRADAS = 5_000;

interface Entrada {
  usuario: Usuario;
  expiraEn: number;
}

@Injectable()
export class CacheUsuarios {
  private readonly entradas = new Map<string, Entrada>();

  obtener(clerkUserId: string): Usuario | undefined {
    const entrada = this.entradas.get(clerkUserId);
    if (!entrada) return undefined;
    if (Date.now() > entrada.expiraEn) {
      this.entradas.delete(clerkUserId);
      return undefined;
    }
    return entrada.usuario;
  }

  guardar(clerkUserId: string, usuario: Usuario): void {
    // Poda simple: si se llena, se descarta la entrada más vieja (Map preserva
    // orden de inserción). Evita que la cache crezca sin límite.
    if (this.entradas.size >= MAX_ENTRADAS) {
      const masVieja = this.entradas.keys().next().value;
      if (masVieja !== undefined) this.entradas.delete(masVieja);
    }
    this.entradas.set(clerkUserId, { usuario, expiraEn: Date.now() + TTL_MS });
  }

  /** Invalida un usuario (p. ej. tras cambiarle el rol). */
  invalidar(clerkUserId: string): void {
    this.entradas.delete(clerkUserId);
  }

  limpiar(): void {
    this.entradas.clear();
  }
}
