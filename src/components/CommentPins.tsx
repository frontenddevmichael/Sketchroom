import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Editor } from 'tldraw';
import { X, MessageSquare, Check, RotateCcw, Trash2, Send } from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import './CommentPins.css';

interface CommentPinsProps {
  editor: Editor | null;
  roomId: Id<'rooms'> | undefined;
  commentMode: boolean;
  onExitCommentMode: () => void;
}

interface CommentData {
  _id: Id<'comments'>;
  userId: string;
  x: number;
  y: number;
  body: string;
  resolved: boolean;
  parentId?: Id<'comments'>;
  createdAt: number;
}

export function CommentPins({ editor, roomId, commentMode, onExitCommentMode }: CommentPinsProps) {
  const { user } = useCurrentUser();
  const comments = useQuery(
    api.features.comments.listComments,
    roomId ? { roomId, resolved: false } : 'skip'
  ) as unknown as CommentData[] | undefined;
  const createComment = useMutation(api.features.comments.createComment);
  const replyToComment = useMutation(api.features.comments.replyToComment);
  const resolveComment = useMutation(api.features.comments.resolveComment);
  const reopenComment = useMutation(api.features.comments.reopenComment);
  const deleteComment = useMutation(api.features.comments.deleteComment);

  const [activePin, setActivePin] = useState<Id<'comments'> | null>(null);
  const [replyTo, setReplyTo] = useState<Id<'comments'> | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [newCommentBody, setNewCommentBody] = useState('');
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });

  // Track camera for pin positioning
  const handleEditorMount = useCallback((ed: Editor) => {
    const sync = () => {
      const cam = ed.getCamera();
      setCamera((prev) =>
        prev.x === cam.x && prev.y === cam.y && prev.z === cam.z
          ? prev
          : { x: cam.x, y: cam.y, z: cam.z }
      );
    };
    sync();
    const unlisten = ed.store.listen(() => requestAnimationFrame(sync));
    return unlisten;
  }, []);

  // Register editor listener
  const editorRef = useRef(editor);
  editorRef.current = editor;
  useEffect(() => {
    if (editor) return handleEditorMount(editor);
  }, [editor, handleEditorMount]);

  // Handle canvas click in comment mode
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!commentMode || !editor) return;
      const ed = editor;
      // Convert screen coords to page coords
      const pagePos = ed.screenToPage({
        x: e.clientX,
        y: e.clientY,
      });
      setPendingPos({ x: pagePos.x, y: pagePos.y });
      setNewCommentBody('');
    },
    [commentMode, editor]
  );

  const submitNewComment = useCallback(async () => {
    if (!pendingPos || !newCommentBody.trim() || !roomId) return;
    await createComment({
      roomId,
      x: pendingPos.x,
      y: pendingPos.y,
      body: newCommentBody.trim(),
    });
    setPendingPos(null);
    setNewCommentBody('');
    onExitCommentMode();
  }, [pendingPos, newCommentBody, roomId, createComment, onExitCommentMode]);

  const submitReply = useCallback(async () => {
    if (!replyTo || !replyBody.trim()) return;
    await replyToComment({ parentId: replyTo, body: replyBody.trim() });
    setReplyTo(null);
    setReplyBody('');
  }, [replyTo, replyBody, replyToComment]);

  if (!editor || !roomId) return null;

  const visibleComments = (comments ?? []).filter((c) => !c.parentId);
  const getReplies = (parentId: Id<'comments'>) =>
    (comments ?? []).filter((c) => c.parentId === parentId);

  const pageToScreen = (px: number, py: number) => ({
    x: (px - camera.x) * camera.z,
    y: (py - camera.y) * camera.z,
  });

  return (
    <>
      {/* Click handler overlay for comment mode */}
      {commentMode && (
        <div
          className="comment-click-overlay"
          onClick={handleCanvasClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCanvasClick(e as unknown as React.MouseEvent);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Click to place a comment"
          style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: 'crosshair' }}
        />
      )}

      {/* Pending new comment form */}
      {pendingPos && (
        <div
          className="comment-pin-form glass"
          style={{
            left: (pendingPos.x - camera.x) * camera.z,
            top: (pendingPos.y - camera.y) * camera.z,
          }}
        >
          <textarea
            className="comment-input"
            placeholder="Leave a comment…"
            value={newCommentBody}
            onChange={(e) => setNewCommentBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitNewComment();
              }
              if (e.key === 'Escape') setPendingPos(null);
            }}
            autoFocus
            rows={2}
          />
          <div className="comment-form-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setPendingPos(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={submitNewComment}
              disabled={!newCommentBody.trim()}
            >
              <Send size={12} />
              Comment
            </button>
          </div>
        </div>
      )}

      {/* Comment pins */}
      {visibleComments.map((comment) => {
        const screen = pageToScreen(comment.x, comment.y);
        const replies = getReplies(comment._id);
        const isExpanded = activePin === comment._id;
        const isAuthor = comment.userId === user?.id;

        return (
          <div
            key={comment._id}
            className={`comment-pin ${isExpanded ? 'expanded' : ''}`}
            style={{ left: screen.x, top: screen.y }}
          >
            <button
              className="comment-pin-dot"
              onClick={() => setActivePin(isExpanded ? null : comment._id)}
              aria-label={`${replies.length + 1} comment${replies.length > 0 ? 's' : ''}`}
            >
              <MessageSquare size={14} />
              {replies.length > 0 && (
                <span className="comment-pin-count">{replies.length}</span>
              )}
            </button>

            {isExpanded && (
              <div className="comment-thread glass">
                <div className="comment-thread-header">
                  <span className="comment-thread-title">Thread</span>
                  <button
                    className="comment-thread-close"
                    onClick={() => setActivePin(null)}
                    aria-label="Close thread"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Original comment */}
                <div className="comment-item">
                  <div className="comment-item-body">{comment.body}</div>
                  <div className="comment-item-meta">
                    <span>{new Date(comment.createdAt).toLocaleTimeString()}</span>
                    {isAuthor && (
                      <button
                        className="comment-action-btn"
                        onClick={() => deleteComment({ commentId: comment._id })}
                        aria-label="Delete comment"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Replies */}
                {replies.map((reply) => (
                  <div key={reply._id} className="comment-item comment-reply">
                    <div className="comment-item-body">{reply.body}</div>
                    <div className="comment-item-meta">
                      <span>{new Date(reply.createdAt).toLocaleTimeString()}</span>
                      {reply.userId === user?.id && (
                        <button
                          className="comment-action-btn"
                          onClick={() => deleteComment({ commentId: reply._id })}
                          aria-label="Delete reply"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Reply input */}
                {replyTo === comment._id ? (
                  <div className="comment-reply-form">
                    <textarea
                      className="comment-input comment-input-sm"
                      placeholder="Reply…"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitReply();
                        }
                        if (e.key === 'Escape') {
                          setReplyTo(null);
                          setReplyBody('');
                        }
                      }}
                      autoFocus
                      rows={1}
                    />
                    <div className="comment-form-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setReplyTo(null); setReplyBody(''); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={submitReply}
                        disabled={!replyBody.trim()}
                      >
                        <Send size={12} />
                        Reply
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="comment-reply-btn"
                    onClick={() => setReplyTo(comment._id)}
                  >
                    Reply
                  </button>
                )}

                {/* Resolve/Reopen */}
                <button
                  className="comment-resolve-btn"
                  onClick={() =>
                    comment.resolved
                      ? reopenComment({ commentId: comment._id })
                      : resolveComment({ commentId: comment._id })
                  }
                >
                  {comment.resolved ? (
                    <>
                      <RotateCcw size={12} />
                      Reopen
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      Resolve
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
