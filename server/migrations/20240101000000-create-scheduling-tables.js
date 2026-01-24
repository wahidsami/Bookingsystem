/**
 * Migration: Create Scheduling Tables
 * Creates StaffShift, StaffBreak, StaffTimeOff, and StaffScheduleOverride tables
 * 
 * Run with: npx sequelize-cli db:migrate
 * Or manually execute the SQL below
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Create staff_shifts table
    await queryInterface.createTable('staff_shifts', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      staffId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'staff',
          key: 'id'
        },
        onDelete: 'CASCADE',
        field: 'staff_id'
      },
      dayOfWeek: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
          max: 6
        },
        comment: 'Day of week for recurring shifts (0=Sunday, 6=Saturday). null = date-specific shift',
        field: 'day_of_week'
      },
      specificDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Specific date for one-time shifts. null = recurring',
        field: 'specific_date'
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: false,
        field: 'start_time'
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: false,
        field: 'end_time'
      },
      isRecurring: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'If true, shift repeats weekly. If false, use specificDate',
        field: 'is_recurring'
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Start date for recurring shifts (null = starts immediately)',
        field: 'start_date'
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'End date for recurring shifts (null = no end date)',
        field: 'end_date'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
      },
      label: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Optional label: "Morning Shift", "Evening Shift", etc.'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at'
      }
    });

    // Create indexes for staff_shifts
    await queryInterface.addIndex('staff_shifts', ['staff_id', 'day_of_week'], {
      name: 'idx_staff_shifts_staff_day'
    });
    await queryInterface.addIndex('staff_shifts', ['staff_id', 'specific_date'], {
      name: 'idx_staff_shifts_staff_date'
    });
    await queryInterface.addIndex('staff_shifts', ['is_active'], {
      name: 'idx_staff_shifts_active'
    });

    // Create staff_breaks table
    await queryInterface.createTable('staff_breaks', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      staffId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'staff',
          key: 'id'
        },
        onDelete: 'CASCADE',
        field: 'staff_id'
      },
      dayOfWeek: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
          max: 6
        },
        comment: 'Day of week for recurring breaks. null = date-specific break',
        field: 'day_of_week'
      },
      specificDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Specific date for one-time breaks. null = recurring',
        field: 'specific_date'
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: false,
        field: 'start_time'
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: false,
        field: 'end_time'
      },
      type: {
        type: DataTypes.ENUM('lunch', 'prayer', 'cleaning', 'other'),
        defaultValue: 'lunch',
        comment: 'Type of break'
      },
      label: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Break label: "Lunch Break", "Prayer Time", "Cleaning Time", etc.'
      },
      isRecurring: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'If true, break repeats weekly. If false, use specificDate',
        field: 'is_recurring'
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Start date for recurring breaks (null = starts immediately)',
        field: 'start_date'
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'End date for recurring breaks (null = no end date)',
        field: 'end_date'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at'
      }
    });

    // Create indexes for staff_breaks
    await queryInterface.addIndex('staff_breaks', ['staff_id', 'day_of_week'], {
      name: 'idx_staff_breaks_staff_day'
    });
    await queryInterface.addIndex('staff_breaks', ['staff_id', 'specific_date'], {
      name: 'idx_staff_breaks_staff_date'
    });
    await queryInterface.addIndex('staff_breaks', ['is_active'], {
      name: 'idx_staff_breaks_active'
    });

    // Create staff_time_off table
    await queryInterface.createTable('staff_time_off', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      staffId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'staff',
          key: 'id'
        },
        onDelete: 'CASCADE',
        field: 'staff_id'
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Start date of time off',
        field: 'start_date'
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'End date of time off (inclusive)',
        field: 'end_date'
      },
      type: {
        type: DataTypes.ENUM('vacation', 'sick', 'personal', 'training', 'other'),
        defaultValue: 'vacation',
        comment: 'Type of time off'
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for time off'
      },
      isApproved: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'For future approval workflow',
        field: 'is_approved'
      },
      approvedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Tenant user ID who approved (for future)',
        field: 'approved_by'
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'approved_at'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at'
      }
    });

    // Create indexes for staff_time_off
    await queryInterface.addIndex('staff_time_off', ['staff_id', 'start_date', 'end_date'], {
      name: 'idx_staff_time_off_staff_dates'
    });
    await queryInterface.addIndex('staff_time_off', ['is_approved'], {
      name: 'idx_staff_time_off_approved'
    });

    // Create staff_schedule_overrides table
    await queryInterface.createTable('staff_schedule_overrides', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      staffId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'staff',
          key: 'id'
        },
        onDelete: 'CASCADE',
        field: 'staff_id'
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Specific date for this override'
      },
      type: {
        type: DataTypes.ENUM('override', 'exception'),
        defaultValue: 'override',
        comment: 'override = replace normal schedule, exception = add special hours'
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: true,
        comment: 'Override start time. null = day off',
        field: 'start_time'
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: true,
        comment: 'Override end time. null = day off',
        field: 'end_time'
      },
      isAvailable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'false = day off, true = available (with override hours if provided)',
        field: 'is_available'
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for override: "Ramadan hours", "Holiday", "Special event", etc.'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at'
      }
    });

    // Create unique constraint and indexes for staff_schedule_overrides
    await queryInterface.addIndex('staff_schedule_overrides', ['staff_id', 'date'], {
      unique: true,
      name: 'unique_staff_date_override'
    });
    await queryInterface.addIndex('staff_schedule_overrides', ['staff_id', 'date'], {
      name: 'idx_staff_overrides_staff_date'
    });
    await queryInterface.addIndex('staff_schedule_overrides', ['is_available'], {
      name: 'idx_staff_overrides_available'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order (respecting foreign key constraints)
    await queryInterface.dropTable('staff_schedule_overrides');
    await queryInterface.dropTable('staff_time_off');
    await queryInterface.dropTable('staff_breaks');
    await queryInterface.dropTable('staff_shifts');
  }
};

