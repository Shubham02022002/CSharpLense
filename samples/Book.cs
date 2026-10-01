using System;
public interface IPaymentService
{
    void Pay(decimal amount);
}

public class PaymentService : IPaymentService
{
    public void Pay(decimal amount)
    {
        Console.WriteLine($"Paid {amount}");
    }
}

public class Order
{
    private readonly IPaymentService _paymentService;

    public Order(IPaymentService paymentService)
    {
        _paymentService = paymentService;
    }

    public void Checkout(decimal amount)
    {
        _paymentService.Pay(amount);
    }

}