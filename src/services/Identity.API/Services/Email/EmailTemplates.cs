using System.Net.Mail;

namespace Identity.API.Services.Email;

public static class EmailTemplates
{
    public static EmailMessage BuildVerification(string toEmail, string verifyUrl) =>
        new(
            To: toEmail,
            Subject: "Подтвердите email на Copiuma",
            Body:
                "Здравствуйте!\n\n" +
                "Чтобы подтвердить адрес, перейдите по ссылке (действительна 24 часа):\n" +
                $"{verifyUrl}\n\n" +
                "Если вы не регистрировались на Copiuma — просто проигнорируйте письмо.\n");

    public static EmailMessage BuildPasswordReset(string toEmail, string resetUrl) =>
        new(
            To: toEmail,
            Subject: "Сброс пароля Copiuma",
            Body:
                "Здравствуйте!\n\n" +
                "Чтобы задать новый пароль, перейдите по ссылке (действительна 1 час):\n" +
                $"{resetUrl}\n\n" +
                "Если вы не запрашивали сброс пароля — игнорируйте письмо. Текущий пароль остаётся в силе.\n");
}