import {
  HubSettingsBitField,
  HubSettingsBits,
  type HubSettingsString,
} from '#main/utils/BitFields.js';
import db from '#main/utils/Db.js';
import { hubs } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';

export default class HubSettingsManager {
  private hubId: string;
  private settings: HubSettingsBitField;

  constructor(hubId: string, initialSettings?: number) {
    this.hubId = hubId;
    this.settings = new HubSettingsBitField(initialSettings || 0);
  }

  static async create(hubId: string): Promise<HubSettingsManager> {
    const hub = await db.hubs.findUnique({ where: { id: hubId } });
    if (!hub) throw new Error('Hub not found');
    return new HubSettingsManager(hubId, hub.settings);
  }

  async updateSetting(setting: HubSettingsString, value?: boolean): Promise<void> {
    if (value) this.settings.add(setting);
    else if (value === undefined) this.settings.toggle(setting);
    else this.settings.remove(setting);

    await this.saveSettings();
  }

  async updateMultipleSettings(
    updates: Partial<Record<HubSettingsString, boolean>>,
  ): Promise<void> {
    for (const [setting, value] of Object.entries(updates)) {
      if (value) this.settings.add(setting as HubSettingsString);
      else this.settings.remove(setting as HubSettingsString);
    }

    await this.saveSettings();
  }

  getSetting(setting: HubSettingsString): boolean {
    return this.settings.has(setting);
  }

  getAllSettings(): Record<HubSettingsString, boolean> {
    return this.settings.serialize();
  }

  getSettingsEmbed(): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('Hub Settings')
      .setColor('#0099ff')
      .setDescription('Current settings for this hub:');

    for (const [key, value] of Object.entries(this.getAllSettings())) {
      embed.addFields({ name: key, value: value ? '✅ Enabled' : '❌ Disabled', inline: true });
    }

    return embed;
  }

  private async saveSettings(): Promise<hubs> {
    return await db.hubs.update({
      where: { id: this.hubId },
      data: { settings: this.settings.bitfield },
    });
  }

  // Helper method to reset all settings to default
  async resetToDefault(): Promise<void> {
    this.settings = new HubSettingsBitField(0);
    await this.saveSettings();
  }

  // Helper method to enable all settings
  async enableAll(): Promise<void> {
    this.settings.add(Object.keys(HubSettingsBits) as HubSettingsString[]);

    await this.saveSettings();
  }

  // Helper method to disable all settings
  async disableAll(): Promise<void> {
    this.settings = new HubSettingsBitField(0);
    await this.saveSettings();
  }
}
