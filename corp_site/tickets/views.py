from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.messages.views import SuccessMessageMixin
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from .forms import AuthenticatedCommentForm, CommentForm, TicketForm
from .models import Ticket
from .throttle import rate_limited

# Лимиты анонимных записей с одного IP (политика доступа: анонимная подача
# заявок разрешена, но сайт публичный — без лимитов это открытая дверь спаму).
ANON_TICKETS_PER_HOUR = 10
ANON_COMMENTS_PER_HOUR = 30


class TicketListView(ListView):
    model = Ticket
    context_object_name = "tickets"
    template_name = "tickets/ticket_list.html"
    paginate_by = 10

    def show_archive(self) -> bool:
        return bool(self.request.GET.get("archived")) and self.request.user.is_authenticated

    def get_queryset(self):
        queryset = super().get_queryset().filter(is_archived=self.show_archive())
        q = self.request.GET.get("q", "").strip()
        status = self.request.GET.get("status", "")
        priority = self.request.GET.get("priority", "")
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q) | Q(description__icontains=q)
            )
        if status in Ticket.Status.values:
            queryset = queryset.filter(status=status)
        if priority.isdigit() and int(priority) in Ticket.Priority.values:
            queryset = queryset.filter(priority=int(priority))
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["search_query"] = self.request.GET.get("q", "").strip()
        context["status_filter"] = self.request.GET.get("status", "")
        context["priority_filter"] = self.request.GET.get("priority", "")
        context["status_choices"] = Ticket.Status.choices
        context["priority_choices"] = Ticket.Priority.choices
        context["show_archive"] = self.show_archive()
        # Строка запроса без page — чтобы пагинация не сбрасывала фильтры.
        params = self.request.GET.copy()
        params.pop("page", None)
        context["querystring"] = params.urlencode()
        return context


class TicketDetailView(DetailView):
    model = Ticket
    context_object_name = "ticket"
    template_name = "tickets/ticket_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["comments"] = self.object.comments.select_related("author")
        if "comment_form" not in context:
            if self.request.user.is_authenticated:
                context["comment_form"] = AuthenticatedCommentForm()
            else:
                context["comment_form"] = CommentForm()
        return context


class TicketCreateView(SuccessMessageMixin, CreateView):
    model = Ticket
    form_class = TicketForm
    template_name = "tickets/ticket_form.html"
    success_message = "Заявка создана."

    def post(self, request, *args, **kwargs):
        if not request.user.is_authenticated and rate_limited(
            request, "ticket-create", ANON_TICKETS_PER_HOUR, 3600
        ):
            messages.error(
                request, "Слишком много заявок с вашего адреса. Попробуйте позже."
            )
            return redirect("ticket_list")
        return super().post(request, *args, **kwargs)

    def form_valid(self, form):
        if self.request.user.is_authenticated:
            form.instance.created_by = self.request.user
        return super().form_valid(form)

    def get_success_url(self):
        return self.object.get_absolute_url()


class TicketUpdateView(LoginRequiredMixin, SuccessMessageMixin, UpdateView):
    model = Ticket
    form_class = TicketForm
    template_name = "tickets/ticket_form.html"
    success_message = "Заявка обновлена."

    def get_success_url(self):
        return self.object.get_absolute_url()


class TicketDeleteView(LoginRequiredMixin, DeleteView):
    """Мягкое удаление: заявка уходит в архив, история и комментарии сохраняются."""

    model = Ticket
    template_name = "tickets/ticket_confirm_delete.html"
    success_url = reverse_lazy("ticket_list")

    def form_valid(self, form):
        self.object.is_archived = True
        self.object.save(update_fields=["is_archived", "updated_at"])
        messages.success(self.request, "Заявка перенесена в архив.")
        return redirect(self.success_url)


@login_required
@require_POST
def ticket_restore(request, pk):
    ticket = get_object_or_404(Ticket, pk=pk, is_archived=True)
    ticket.is_archived = False
    ticket.save(update_fields=["is_archived", "updated_at"])
    messages.success(request, "Заявка восстановлена из архива.")
    return redirect("ticket_detail", pk=ticket.pk)


def add_comment(request, pk):
    ticket = get_object_or_404(Ticket, pk=pk)
    if request.method != "POST":
        return redirect("ticket_detail", pk=ticket.pk)

    if not request.user.is_authenticated and rate_limited(
        request, "comment-create", ANON_COMMENTS_PER_HOUR, 3600
    ):
        messages.error(
            request, "Слишком много комментариев с вашего адреса. Попробуйте позже."
        )
        return redirect("ticket_detail", pk=ticket.pk)

    if request.user.is_authenticated:
        form = AuthenticatedCommentForm(request.POST)
    else:
        form = CommentForm(request.POST)

    if form.is_valid():
        comment = form.save(commit=False)
        comment.ticket = ticket
        if request.user.is_authenticated:
            comment.author = request.user
            comment.author_name = (
                request.user.get_full_name() or request.user.username
            )
        comment.save()
        messages.success(request, "Комментарий добавлен.")
        return redirect("ticket_detail", pk=ticket.pk)

    # Невалидная форма: показываем страницу заявки с ошибками,
    # чтобы введённый текст не потерялся.
    context = {
        "ticket": ticket,
        "comments": ticket.comments.select_related("author"),
        "comment_form": form,
    }
    return render(request, "tickets/ticket_detail.html", context)
