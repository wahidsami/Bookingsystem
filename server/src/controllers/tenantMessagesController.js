const db = require('../models');

exports.getMessages = async (req, res) => {
    try {
        const tenantId = req.tenantId;

        const messages = await db.StaffMessage.findAll({
            where: {
                tenantId,
                senderId: tenantId,
                senderType: 'admin'
            },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: messages
        });
    } catch (error) {
        console.error('Error fetching tenant messages:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching messages'
        });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { recipientId, subject, body, isPinned } = req.body;

        if (!body) {
            return res.status(400).json({
                success: false,
                message: 'Message body is required'
            });
        }

        if (recipientId) {
            const recipient = await db.Staff.findOne({
                where: { id: recipientId, tenantId }
            });

            if (!recipient) {
                return res.status(404).json({
                    success: false,
                    message: 'Recipient not found'
                });
            }
        }

        const message = await db.StaffMessage.create({
            tenantId,
            senderType: 'admin',
            senderId: tenantId,
            recipientType: recipientId ? 'staff' : null,
            recipientId: recipientId || null,
            subject: subject || null,
            body,
            isPinned: !!isPinned,
            readBy: []
        });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: message
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while sending message'
        });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;

        const deletedCount = await db.StaffMessage.destroy({
            where: { id, tenantId }
        });

        if (deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting message'
        });
    }
};
