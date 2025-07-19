import { PrismaClient } from '../generated/prisma';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Verificar se o usuário já existe
  const existingUser = await prisma.user.findUnique({
    where: { email: 'n@g.com' },
  });

  if (existingUser) {
    console.log('👤 User n@g.com already exists, skipping...');
  } else {
    // Hash da senha
    const hashedPassword = await bcrypt.hash('change123', 10);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name: 'Nicolas',
        email: 'n@g.com',
        password: hashedPassword,
      },
    });

    console.log('✅ User created successfully:', {
      id: user.id,
      name: user.name,
      email: user.email,
    });
  }

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
