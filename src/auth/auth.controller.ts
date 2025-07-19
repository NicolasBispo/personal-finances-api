import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto, AuthResponseDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body() signupDto: SignupDto,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.authService.signup(signupDto);
    const token = this.authService.generateToken(user.id);

    res
      .status(HttpStatus.CREATED)
      .header('Authorization', `Bearer ${token}`)
      .json(user);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res() res: Response): Promise<void> {
    console.log('loginDto', loginDto);
    const user = await this.authService.login(loginDto);
    const token = this.authService.generateToken(user.id);
    console.log('retornando user', user);
    res
      .status(HttpStatus.OK)
      .header('Authorization', `Bearer ${token}`)
      .json(user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthResponseDto): AuthResponseDto {
    return user;
  }
}
