const db = require('../models');
const { UserAddress } = db;

// Get all addresses for user
exports.getAddresses = async (req, res) => {
    try {
        const platformUserId = req.user.id;
        const addresses = await UserAddress.findAll({
            where: { platformUserId },
            order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
        });
        res.json({ success: true, addresses });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ success: false, message: 'Server error fetching addresses' });
    }
};

// Create a new address
exports.createAddress = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const platformUserId = req.user.id;
        const { title, street, city, building, floor, apartment, phone, notes, isDefault } = req.body;

        // If this is set as default (or if it's the first address), enforce one default
        const existingCount = await UserAddress.count({ where: { platformUserId }, transaction });
        const shouldBeDefault = isDefault || existingCount === 0;

        if (shouldBeDefault) {
            await UserAddress.update(
                { isDefault: false },
                { where: { platformUserId, isDefault: true }, transaction }
            );
        }

        const address = await UserAddress.create({
            platformUserId,
            title: title || 'Home',
            street,
            city,
            building,
            floor,
            apartment,
            phone,
            notes,
            isDefault: shouldBeDefault
        }, { transaction });

        await transaction.commit();
        res.status(201).json({ success: true, address });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating address:', error);
        res.status(500).json({ success: false, message: 'Server error creating address' });
    }
};

// Update an address
exports.updateAddress = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const platformUserId = req.user.id;
        const addressId = req.params.id;
        const { title, street, city, building, floor, apartment, phone, notes, isDefault } = req.body;

        const address = await UserAddress.findOne({
            where: { id: addressId, platformUserId },
            transaction
        });

        if (!address) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        // Enforce ONE default address
        if (isDefault && !address.isDefault) {
            await UserAddress.update(
                { isDefault: false },
                { where: { platformUserId, isDefault: true }, transaction }
            );
        }

        // If turning OFF default, check if it's the only address. We might not allow unsetting the only default.
        let finalIsDefault = isDefault;
        if (!isDefault && address.isDefault) {
            const otherAddressCount = await UserAddress.count({
                where: { platformUserId, id: { [db.Sequelize.Op.ne]: addressId } },
                transaction
            });
            if (otherAddressCount === 0) {
                finalIsDefault = true; // Must have a default if it's the only one
            } else {
                // We should make another address default if we turn this one off
                // Or just let it be off. It's safer to always have one.
                const nextAddress = await UserAddress.findOne({
                    where: { platformUserId, id: { [db.Sequelize.Op.ne]: addressId } },
                    transaction,
                    order: [['createdAt', 'DESC']]
                });
                if (nextAddress) {
                    await nextAddress.update({ isDefault: true }, { transaction });
                }
            }
        }

        await address.update({
            title,
            street,
            city,
            building,
            floor,
            apartment,
            phone,
            notes,
            isDefault: finalIsDefault !== undefined ? finalIsDefault : address.isDefault
        }, { transaction });

        await transaction.commit();
        res.json({ success: true, address });
    } catch (error) {
        await transaction.rollback();
        console.error('Error updating address:', error);
        res.status(500).json({ success: false, message: 'Server error updating address' });
    }
};

// Delete an address
exports.deleteAddress = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const platformUserId = req.user.id;
        const addressId = req.params.id;

        const address = await UserAddress.findOne({
            where: { id: addressId, platformUserId },
            transaction
        });

        if (!address) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        const wasDefault = address.isDefault;
        await address.destroy({ transaction });

        // If we deleted the default address, make the most recently added address the new default
        if (wasDefault) {
            const nextAddress = await UserAddress.findOne({
                where: { platformUserId },
                order: [['createdAt', 'DESC']],
                transaction
            });
            if (nextAddress) {
                await nextAddress.update({ isDefault: true }, { transaction });
            }
        }

        await transaction.commit();
        res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, message: 'Server error deleting address' });
    }
};
