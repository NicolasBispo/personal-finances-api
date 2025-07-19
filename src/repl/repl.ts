#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ReplService } from './repl.service';
import * as repl from 'repl';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const replService = app.get(ReplService);

  console.log('🚀 Personal Finances REPL');
  console.log('Type "help" to see available commands and examples');
  console.log('Type ".exit" to quit\n');

  // Criar o REPL
  const replServer = repl.start({
    prompt: 'personal-finances> ',
    useColors: true,
    ignoreUndefined: true,
  });

  // Expor o serviço REPL globalmente
  (replServer.context as any).repl = replService;

  // Adicionar comandos especiais
  (replServer.context as any).help = () => {
    replService.showHelp();
  };

  // Adicionar utilitários globais
  (replServer.context as any).clear = () => {
    console.clear();
  };

  // Adicionar exemplo de uso
  (replServer.context as any).example = () => {
    console.log('\n💡 Exemplo de uso:');
    console.log('// Criar um usuário');
    console.log('await repl.createUser("João", "joao@email.com", "senha123")');
    console.log('\n// Buscar todos os usuários');
    console.log('await repl.services.prisma.user.findMany()');
    console.log('\n// Ver estatísticas');
    console.log('await repl.getStats()');
    console.log('\n// Criar uma transação');
    console.log('await repl.createTransaction({');
    console.log('  amountInCents: 15050, // R$ 150,50 em centavos');
    console.log('  date: new Date("2024-01-15"),');
    console.log('  description: "Almoço",');
    console.log('  type: repl.models.TransactionType.EXPENSE,');
    console.log('  status: repl.models.TransactionStatus.PAID,');
    console.log('  userId: "user-id-aqui"');
    console.log('})');
  };

  // Mostrar ajuda inicial
  replService.showHelp();

  // Lidar com saída
  replServer.on('exit', async () => {
    console.log('\n👋 Goodbye!');
    await app.close();
    process.exit(0);
  });

  // Lidar com erros
  replServer.on('error', (err) => {
    console.error('❌ REPL Error:', err);
  });
}

bootstrap().catch(console.error);
