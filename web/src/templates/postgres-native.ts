import type { Template } from './types';

interface PostgresNativeValues {
  target: {
    dumpPath: string;
    databaseUsername: string;
    databaseName: string;
    databasePassword: string;
  };
  profile: {
    profileName: string;
    storageLocationId: number;
    namingRuleId: number;
    scheduleCron: string;
  };
}

export const postgresNativeTemplate: Template<PostgresNativeValues> = {
  name: 'PostgreSQL (host / no Docker)',
  description: 'Backup PostgreSQL running directly on the host using pg_dump; downloads the dump and cleans up.',

  steps: [
    {
      id: 'target',
      title: 'Target',
      description: 'Choose a temporary dump file path on the selected server.',
      inputs: [
        {
          id: 'databaseUsername',
          config: {
            type: 'string',
            title: 'Database User',
            description: 'User used by pg_dump.',
            required: true,
          },
        },
        {
          id: 'databaseName',
          config: {
            type: 'string',
            title: 'Database Name',
            description: 'The database name passed to pg_dump.',
            required: true,
          },
        },
        {
          id: 'databasePassword',
          config: {
            type: 'password',
            title: 'Database Password',
            description: 'Password for the specified PostgreSQL user.',
            required: false,
          },
        },
        {
          id: 'dumpPath',
          config: {
            type: 'string',
            title: 'Temporary Dump File Path',
            description: 'Absolute path on the selected server where the SQL dump will be written.',
            default: '/tmp/db_backup.sql',
            required: true,
          },
        },
      ],
    },
    {
      id: 'profile',
      title: 'Profile',
      description: 'Choose storage and naming rule, and optionally configure a schedule.',
      inputs: [
        {
          id: 'profileName',
          config: {
            type: 'string',
            title: 'Profile Name',
            description: 'A descriptive name for this backup profile.',
            required: true,
          },
        },
        {
          id: 'storageLocationId',
          config: {
            type: 'storage_location',
            title: 'Storage Location',
            description: 'Select the storage location for this profile.',
            required: true,
          },
        },
        {
          id: 'namingRuleId',
          config: {
            type: 'naming_rule',
            title: 'Naming Rule',
            description: 'Select how backup files should be named.',
            required: true,
          },
        },
        {
          id: 'scheduleCron',
          config: {
            type: 'cron',
            title: 'Schedule (Cron Expression)',
            description: 'If set, the backup will run automatically based on this cron expression.',
          },
        },
      ],
    },
  ],

  buildResult: (ctx) => {
    const { dumpPath, databaseUsername, databaseName, databasePassword } = ctx.values.target;
    const { profileName, storageLocationId, namingRuleId, scheduleCron } = ctx.values.profile;

    return {
      profile: {
        name: profileName,
        server_id: ctx.server.id,
        storage_location_id: storageLocationId,
        naming_rule_id: namingRuleId,
        schedule_cron: scheduleCron,
        enabled: false,
      },
      commands: [
        {
          run_stage: 'pre',
          command: `PGPASSWORD=${databasePassword} pg_dump -U ${databaseUsername} -d ${databaseName} -f ${dumpPath}`,
        },
        {
          run_stage: 'post',
          command: `rm -f ${dumpPath}`,
        },
      ],
      fileRules: [
        {
          remote_path: dumpPath,
          recursive: false,
        },
      ],
    };
  },
};
