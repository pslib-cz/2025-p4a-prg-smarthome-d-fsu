# Zapojení senzorů na ESP
| Název senzoru | Pin na senzoru | Kam na ESP |
| ----------- | ----------- | ----------- |
| BME280 | VCC | 3V3 |
| BME280 | GND | GND |
| BME280 | SCL | GPIO4 |
| BME280 | SDA | GPIO5 |
| BME280 | CSB | 3V3 |
| BME280 | SDO | GND |
| MPU-6050 | VCC | 3V3 |
| MPU-6050 | GND | GND |
| MPU-6050 | SCL | GPIO4 |
| MPU-6050 | SDA | GPIO5 |
| MPU-6050 | AD0 | GND |
| MPU-6050 | INT | GPIO8 |
| INA219 | VCC | 3V3 |
| INA219 | GND | GND |
| INA219 | SCL | GPIO6 |
| INA219 | SDA | GPIO7 |
| OLED | GND | GND |
| OLED | VDD | 3V3 |
| OLED | SCL | GPIO6 |
| OLED | SDA | GPIO7 |
| SWITCH | 1 | GPIO1 |
| SWITCH | 3 | GND (out) |
| LED (cob strip) | DI | GPIO2 |

# Napájení
| Zdrojové zařízení | Zdrojový port | Cílové zařízení | Cílový port |
| ----------- | ----------- | ----------- | ----------- |
| BMS | 5V | INA219 | VIN+ |
| BMS | 5V | LED (cob strip) | DC5V |
| LED (cob strip) | DNG (GND) | BMS | GND |
| INA219 | VIN- | ESP32-S3 | 5Vin |
| ESP32-S3 | GND | BMS | GND |